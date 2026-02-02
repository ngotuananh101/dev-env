/**
 * Extract Worker - Runs ZIP extraction in a separate thread
 * This prevents the main thread from freezing when extracting large files
 */

const { parentPort, workerData } = require('worker_threads');
const AdmZip = require('adm-zip');
const path = require('path');

const { zipPath, appInstallDir } = workerData;

try {
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
        
        // Report progress every 5% or at completion
        const percent = Math.round((extractedCount / totalEntries) * 100);
        if (percent >= lastReportedPercent + 5 || extractedCount === totalEntries) {
            lastReportedPercent = percent;
            parentPort.postMessage({
                type: 'progress',
                extractedCount,
                totalEntries,
                percent
            });
        }
    }

    parentPort.postMessage({
        type: 'complete',
        extractedCount,
        totalEntries
    });

} catch (error) {
    parentPort.postMessage({
        type: 'error',
        message: error.message
    });
}
