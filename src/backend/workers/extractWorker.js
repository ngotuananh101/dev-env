/**
 * Extract Worker - Runs 7-Zip extraction with fallback to adm-zip
 */

const { parentPort, workerData } = require('worker_threads');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const { zipPath, appInstallDir, sevenZipPath } = workerData;

function extractWithAdmZip() {
    return new Promise((resolve, reject) => {
        try {
            parentPort.postMessage({
                type: 'warning',
                message: 'Falling back to standard extraction...'
            });

            // Give UI a moment to show the warning
            // (Not strictly necessary but nice)

            const zip = new AdmZip(zipPath);
            const zipEntries = zip.getEntries();
            const totalEntries = zipEntries.length;
            let extractedCount = 0;
            let lastReportedPercent = 0;

            parentPort.postMessage({
                type: 'start',
                totalEntries
            });

            for (const entry of zipEntries) {
                try {
                    zip.extractEntryTo(entry, appInstallDir, true, true);
                } catch (err) {
                    parentPort.postMessage({
                        type: 'warning',
                        message: `Failed to extract ${entry.entryName}: ${err.message}`
                    });
                }

                extractedCount++;
                const percent = Math.round((extractedCount / totalEntries) * 100);
                // Report every 5%
                if (percent >= lastReportedPercent + 5 || extractedCount === totalEntries) {
                    lastReportedPercent = percent;
                    parentPort.postMessage({
                        type: 'progress',
                        percent: percent,
                        extractedCount,
                        totalEntries,
                        logDetail: `Extracted ${extractedCount} / ${totalEntries} files`
                    });
                }
            }
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

function extractWith7Zip() {
    return new Promise((resolve, reject) => {
        if (!sevenZipPath || !fs.existsSync(sevenZipPath)) {
            return reject(new Error(`7za.exe not found at ${sevenZipPath}`));
        }

        parentPort.postMessage({
            type: 'start',
            totalEntries: 0 // Unknown
        });

        const args = ['x', zipPath, `-o${appInstallDir}`, '-y', '-bsp1'];
        const child = spawn(sevenZipPath, args);

        let lastPercent = 0;
        let stderr = '';

        child.stdout.on('data', (data) => {
            const output = data.toString();

            // Parse progress
            const simpleMatch = output.match(/\s*(\d+)%/);
            if (simpleMatch) {
                const percent = parseInt(simpleMatch[1], 10);
                if (percent > lastPercent) {
                    lastPercent = percent;
                    parentPort.postMessage({
                        type: 'progress',
                        percent: percent,
                        logDetail: `Extracting... ${percent}%`
                    });
                }
            }

            // Parse filenames for detail
            // 7-Zip -bsp1 output format is tricky to parse reliably for filenames as they might be truncated or mixed
            // But usually lines like: " 19% 4 + folder\file.txt"
            const lines = output.split(/[\r\n]+/);
            for (const line of lines) {
                const detailedMatch = line.match(/\s*(\d+)%\s+\d+\s+\+\s+(.*)/);
                if (detailedMatch) {
                    const filename = detailedMatch[2].trim();
                    parentPort.postMessage({
                        type: 'progress',
                        percent: parseInt(detailedMatch[1], 10),
                        logDetail: `Extracting ${filename}`
                    });
                }
            }
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`7-Zip exited with code ${code}. ${stderr.trim()}`));
            }
        });

        child.on('error', (err) => {
            reject(new Error(`Failed to start 7-Zip: ${err.message}`));
        });
    });
}

(async () => {
    try {
        // Try 7-Zip first
        try {
            await extractWith7Zip();
            parentPort.postMessage({ type: 'complete', percent: 100, logDetail: 'Extraction completed' });
        } catch (sevenZipErr) {
            // Log the error but don't fail yet
            parentPort.postMessage({
                type: 'warning',
                message: `7-Zip failed (${sevenZipErr.message})...`
            });

            // Fallback to AdmZip
            await extractWithAdmZip();
            parentPort.postMessage({ type: 'complete', percent: 100, logDetail: 'Extraction completed' });
        }

    } catch (error) {
        parentPort.postMessage({
            type: 'error',
            message: error.message
        });
    }
})();
