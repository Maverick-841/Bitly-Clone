const redis = require('../config/redis');
const db = require('../config/db');
const useragent = require('useragent'); // We need to install this

exports.handleRedirect = async (req, res) => {
    try {
        const { shortCode } = req.params;

        // Check Redis Cache first
        let cacheData = await redis.get(`url:${shortCode}`);
        let urlData;

        if (cacheData) {
            urlData = JSON.parse(cacheData);
        } else {
            // Fallback to DB
            const result = await db.query('SELECT * FROM urls WHERE short_code = $1 OR custom_alias = $1', [shortCode]);
            if (result.rows.length === 0) {
                return res.status(404).send('URL not found');
            }
            
            const row = result.rows[0];
            urlData = {
                id: row.id,
                originalUrl: row.original_url,
                expirationDate: row.expiration_date,
                clickLimit: row.click_limit,
                password_hash: row.password_hash
            };

            // Re-cache for future
            await redis.set(`url:${shortCode}`, JSON.stringify(urlData));
        }

        // Validity Checks
        if (urlData.expirationDate && new Date() > new Date(urlData.expirationDate)) {
            return res.status(410).send('This link has expired');
        }

        if (urlData.clickLimit > 0) {
            // Count current clicks
            const clickCountResult = await db.query('SELECT COUNT(*) FROM clicks WHERE url_id = $1', [urlData.id]);
            const clickCount = parseInt(clickCountResult.rows[0].count);
            
            if (clickCount >= urlData.clickLimit) {
                return res.status(410).send('This link has reached its click limit');
            }
        }

        // Parse user agent for analytics asynchronously
        const ua = useragent.parse(req.headers['user-agent']);
        const browser = ua.family;
        const device = ua.device.family === 'Other' ? (ua.isMobile ? 'Mobile' : 'Desktop') : ua.device.family;
        const country = req.headers['cf-ipcountry'] || 'Unknown'; // Defaulting to unknown, real implement tracking via IP later if needed

        // Async log click
        db.query(
            'INSERT INTO clicks (url_id, country, device, browser) VALUES ($1, $2, $3, $4)',
            [urlData.id, country, device, browser]
        ).catch(err => console.error('Error logging click:', err));

        // Password Check
        if (urlData.password_hash) {
            // Check if already verified (via a signed cookie or just redirect to password page)
            // For simplicity, we redirect to a dedicated frontend password entry page
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return res.redirect(`${frontendUrl}/${shortCode}/password`);
        }

        // Redirect
        res.redirect(urlData.originalUrl);

    } catch (error) {
        console.error('Redirect error:', error);
        res.status(500).send('Server Error');
    }
};
