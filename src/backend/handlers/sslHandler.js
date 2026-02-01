/**
 * SSL Handler - IPC handlers for SSL certificate management using mkcert
 * Handles: CA initialization, certificate generation, certificate listing
 */

const path = require('path');
const fs = require('fs');
const { execSync, exec } = require('child_process');
const mkcert = require('mkcert');

// Store CA instance
let caInstance = null;
let sslDir = null;
let caInstalledInSystem = false;

/**
 * Initialize SSL directory and CA
 * @param {string} userDataPath - User data directory path
 * @returns {Promise<Object>} - Status object
 */
async function initializeSSL(userDataPath) {
    sslDir = path.join(userDataPath, 'ssl');

    // Ensure SSL directory exists
    if (!fs.existsSync(sslDir)) {
        fs.mkdirSync(sslDir, { recursive: true });
    }

    const caKeyPath = path.join(sslDir, 'ca.key');
    const caCertPath = path.join(sslDir, 'ca.crt');

    try {
        // Check if CA already exists
        if (fs.existsSync(caKeyPath) && fs.existsSync(caCertPath)) {
            console.log('[SSL] CA already exists, loading...');
            const caKey = fs.readFileSync(caKeyPath, 'utf-8');
            const caCert = fs.readFileSync(caCertPath, 'utf-8');
            caInstance = { key: caKey, cert: caCert };
            console.log('[SSL] CA loaded successfully');
            return { success: true, message: 'CA loaded', isNew: false };
        }

        // Create new CA
        console.log('[SSL] Creating new CA...');
        const ca = await mkcert.createCA({
            organization: 'DevEnv Local CA',
            countryCode: 'VN',
            state: 'Vietnam',
            locality: 'Ho Chi Minh',
            validity: 3650 // 10 years
        });

        // Save CA files
        fs.writeFileSync(caKeyPath, ca.key);
        fs.writeFileSync(caCertPath, ca.cert);

        caInstance = ca;
        console.log('[SSL] CA created and saved successfully');
        console.log(`[SSL] CA Certificate: ${caCertPath}`);

        // Auto-install CA to system on first creation
        const installResult = await installCAToSystem(caCertPath);

        return {
            success: true,
            message: 'CA created',
            isNew: true,
            caCertPath: caCertPath,
            caInstalled: installResult.success
        };
    } catch (error) {
        console.error('[SSL] Failed to initialize CA:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if CA is installed in Windows Certificate Store
 * @returns {boolean} - Whether CA is installed
 */
function checkCAInstalled() {
    if (!sslDir) return false;

    const caCertPath = path.join(sslDir, 'ca.crt');
    if (!fs.existsSync(caCertPath)) return false;

    try {
        // Read the certificate to get its thumbprint/serial
        const certContent = fs.readFileSync(caCertPath, 'utf-8');

        // Check in Windows cert store using certutil
        // Look for "DevEnv Local CA" in ROOT store
        const result = execSync('certutil -store ROOT "DevEnv Local CA"', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // If command succeeds and contains certificate info, it's installed
        caInstalledInSystem = result.includes('DevEnv Local CA');
        console.log(`[SSL] CA installed in system: ${caInstalledInSystem}`);
        return caInstalledInSystem;
    } catch (error) {
        // If certutil returns error, certificate is not found
        caInstalledInSystem = false;
        console.log('[SSL] CA not found in system trust store');
        return false;
    }
}

/**
 * Install CA certificate to Windows Trusted Root store
 * Requires admin privileges - will prompt UAC
 * @param {string} caCertPath - Path to CA certificate file
 * @returns {Promise<Object>} - Result
 */
async function installCAToSystem(caCertPath) {
    if (!caCertPath) {
        caCertPath = sslDir ? path.join(sslDir, 'ca.crt') : null;
    }

    if (!caCertPath || !fs.existsSync(caCertPath)) {
        return { success: false, error: 'CA certificate not found' };
    }

    // First check if already installed
    if (checkCAInstalled()) {
        console.log('[SSL] CA already installed in system');
        return { success: true, alreadyInstalled: true };
    }

    console.log('[SSL] Installing CA to Windows trust store...');

    try {
        // Use PowerShell to run certutil with admin privileges
        // This will trigger UAC prompt
        const command = `certutil -addstore -f ROOT "${caCertPath}"`;
        const psCommand = `Start-Process -FilePath 'cmd.exe' -ArgumentList '/c ${command.replace(/"/g, '\\"')}' -Verb RunAs -Wait`;

        return new Promise((resolve) => {
            exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
                // Give Windows a moment to update the store
                setTimeout(() => {
                    const installed = checkCAInstalled();
                    if (installed) {
                        console.log('[SSL] CA installed successfully');
                        resolve({ success: true, alreadyInstalled: false });
                    } else {
                        console.log('[SSL] CA installation may have been cancelled or failed');
                        resolve({ success: false, error: 'Installation cancelled or failed' });
                    }
                }, 1000);
            });
        });
    } catch (error) {
        console.error('[SSL] Failed to install CA:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate SSL certificate for a domain
 * @param {string} domain - Domain name (e.g., 'mysite.local')
 * @returns {Promise<Object>} - Certificate paths or error
 */
async function generateCertificate(domain) {
    if (!caInstance) {
        return { success: false, error: 'CA not initialized' };
    }

    if (!domain) {
        return { success: false, error: 'Domain is required' };
    }

    // Sanitize domain for filename
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    const certDir = path.join(sslDir, 'certs');

    // Ensure certs directory exists
    if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
    }

    const keyPath = path.join(certDir, `${safeDomain}.key`);
    const certPath = path.join(certDir, `${safeDomain}.crt`);

    try {
        // Check if cert already exists
        if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
            console.log(`[SSL] Certificate for ${domain} already exists`);
            return {
                success: true,
                exists: true,
                keyPath,
                certPath,
                domain
            };
        }

        console.log(`[SSL] Generating certificate for ${domain}...`);

        const cert = await mkcert.createCert({
            ca: caInstance,
            domains: [domain, `*.${domain}`],
            validity: 825 // ~2.26 years (max recommended)
        });

        // Save certificate files
        fs.writeFileSync(keyPath, cert.key);
        fs.writeFileSync(certPath, cert.cert);

        console.log(`[SSL] Certificate generated for ${domain}`);

        return {
            success: true,
            exists: false,
            keyPath,
            certPath,
            domain
        };
    } catch (error) {
        console.error(`[SSL] Failed to generate certificate for ${domain}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * List all generated certificates
 * @returns {Promise<Object>} - List of certificates
 */
function listCertificates() {
    const certDir = path.join(sslDir, 'certs');

    if (!fs.existsSync(certDir)) {
        return { success: true, certificates: [] };
    }

    try {
        const files = fs.readdirSync(certDir);
        const certificates = [];

        // Group by domain (look for .crt files)
        files.filter(f => f.endsWith('.crt')).forEach(file => {
            const domain = file.replace('.crt', '');
            const keyPath = path.join(certDir, `${domain}.key`);
            const certPath = path.join(certDir, file);

            if (fs.existsSync(keyPath)) {
                const stats = fs.statSync(certPath);
                certificates.push({
                    domain,
                    keyPath,
                    certPath,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime
                });
            }
        });

        return { success: true, certificates };
    } catch (error) {
        console.error('[SSL] Failed to list certificates:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get SSL status and paths
 * @returns {Object} - SSL status
 */
function getSSLStatus() {
    const hasCa = caInstance !== null;
    const caCertPath = sslDir ? path.join(sslDir, 'ca.crt') : null;
    const caExists = caCertPath && fs.existsSync(caCertPath);

    // Check if CA is installed in system (only if we haven't checked yet)
    if (caExists && !caInstalledInSystem) {
        checkCAInstalled();
    }

    return {
        initialized: hasCa,
        caExists,
        caInstalledInSystem,
        sslDir,
        caCertPath: caExists ? caCertPath : null
    };
}

/**
 * Delete a certificate
 * @param {string} domain - Domain to delete certificate for
 * @returns {Object} - Result
 */
function deleteCertificate(domain) {
    if (!domain) {
        return { success: false, error: 'Domain is required' };
    }

    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
    const certDir = path.join(sslDir, 'certs');
    const keyPath = path.join(certDir, `${safeDomain}.key`);
    const certPath = path.join(certDir, `${safeDomain}.crt`);

    try {
        if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
        if (fs.existsSync(certPath)) fs.unlinkSync(certPath);

        console.log(`[SSL] Deleted certificate for ${domain}`);
        return { success: true };
    } catch (error) {
        console.error(`[SSL] Failed to delete certificate for ${domain}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Register SSL-related IPC handlers
 * @param {Electron.IpcMain} ipcMain - Electron IPC Main
 * @param {Object} context - Shared context
 */
function register(ipcMain, context) {
    const { userDataPath } = context;

    // Get SSL status
    ipcMain.handle('ssl-get-status', () => {
        return getSSLStatus();
    });

    // Generate certificate for domain
    ipcMain.handle('ssl-generate-cert', async (event, domain) => {
        return await generateCertificate(domain);
    });

    // List all certificates
    ipcMain.handle('ssl-list-certs', () => {
        return listCertificates();
    });

    // Delete certificate
    ipcMain.handle('ssl-delete-cert', (event, domain) => {
        return deleteCertificate(domain);
    });

    // Install CA to system (manual trigger)
    ipcMain.handle('ssl-install-ca', async () => {
        return await installCAToSystem();
    });
}

module.exports = {
    register,
    initializeSSL,
    generateCertificate,
    listCertificates,
    getSSLStatus,
    deleteCertificate,
    checkCAInstalled,
    installCAToSystem
};
