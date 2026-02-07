const https = require('https');

function get(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'node.js' // GitHub API requires User-Agent
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        const releases = await get('https://api.github.com/repos/zkteco-home/redis-windows/releases');
        console.log(`Found ${releases.length} releases.`);

        if (releases.length > 0) {
            const latest = releases[0];
            console.log('Latest Release:', latest.tag_name);
            console.log('Zipball URL:', latest.zipball_url);
            console.log('Tarball URL:', latest.tarball_url);
            console.log('Assets:', latest.assets.map(a => ({ name: a.name, url: a.browser_download_url })));
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
