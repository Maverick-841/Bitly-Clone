const db = require('../config/db');
const redis = require('../config/redis');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Utility to generate random string
const generateShortCode = (length = 6) => {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
};

exports.shortenUrl = async (req, res) => {
    try {
        const { originalUrl, customAlias, expirationDate, clickLimit, password } = req.body;
        const userId = req.user ? req.user.id : null;

        if (!originalUrl) {
            return res.status(400).json({ message: 'Original URL is required' });
        }

        let shortCode = customAlias;
        if (shortCode) {
            // Check if custom alias is already in use
            const existing = await db.query('SELECT * FROM urls WHERE short_code = $1 OR custom_alias = $2', [shortCode, shortCode]);
            if (existing.rows.length > 0) {
                return res.status(400).json({ message: 'Custom alias is already taken' });
            }
        } else {
            // Generate unique short code
            let isUnique = false;
            while (!isUnique) {
                shortCode = generateShortCode();
                const existing = await db.query('SELECT * FROM urls WHERE short_code = $1', [shortCode]);
                if (existing.rows.length === 0) {
                    isUnique = true;
                }
            }
        }

        let passwordHash = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        // Insert into database
        const result = await db.query(
            'INSERT INTO urls (user_id, original_url, short_code, custom_alias, expiration_date, click_limit, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [userId, originalUrl, shortCode, customAlias || null, expirationDate || null, clickLimit || 0, passwordHash]
        );

        const newUrl = result.rows[0];

        // Cache in redis (shortCode -> originalUrl)
        // Store extra data as JSON for redirect constraints
        const cacheData = JSON.stringify({
            id: newUrl.id,
            originalUrl: newUrl.original_url,
            expirationDate: newUrl.expiration_date,
            clickLimit: newUrl.click_limit
        });
        await redis.set(`url:${shortCode}`, cacheData);
        await redis.set(`clicks:${newUrl.id}`, 0); // Initialize click count in Redis


        res.status(201).json(newUrl);

    } catch (error) {
        console.error('Shorten URL error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getUserUrls = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        // Get total count for pagination
        const countResult = await db.query('SELECT COUNT(*) FROM urls WHERE user_id = $1', [userId]);
        const totalCount = parseInt(countResult.rows[0].count);

        // Get paginated data
        const result = await db.query(
            'SELECT * FROM urls WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [userId, limit, offset]
        );

        res.json({
            urls: result.rows,
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error('Get user URLs error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verify URL belongs to user
        const urlVerify = await db.query('SELECT * FROM urls WHERE id = $1 AND user_id = $2', [id, userId]);
        if (urlVerify.rows.length === 0) {
            return res.status(404).json({ message: 'URL not found or unauthorized' });
        }

        const clicks = await db.query('SELECT * FROM clicks WHERE url_id = $1 ORDER BY timestamp DESC', [id]);
        
        // Aggregate data for Chart.js
        const totalClicks = clicks.rows.length;
        
        // Simple timeline aggregation (last 7 days could be better, but this simple grouping by day)
        const timeline = {};
        const browsers = {};
        const devices = {};
        const countries = {};

        clicks.rows.forEach(click => {
            const date = new Date(click.timestamp).toISOString().split('T')[0];
            timeline[date] = (timeline[date] || 0) + 1;
            
            const b = click.browser || 'Unknown';
            browsers[b] = (browsers[b] || 0) + 1;

            const d = click.device || 'Unknown';
            devices[d] = (devices[d] || 0) + 1;

            const c = click.country || 'Unknown';
            countries[c] = (countries[c] || 0) + 1;
        });

        res.json({
            url: urlVerify.rows[0],
            stats: { totalClicks, timeline, browsers, devices, countries }
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.exportAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verify URL belongs to user
        const urlVerify = await db.query('SELECT * FROM urls WHERE id = $1 AND user_id = $2', [id, userId]);
        if (urlVerify.rows.length === 0) {
            return res.status(404).json({ message: 'URL not found or unauthorized' });
        }

        const clicks = await db.query('SELECT * FROM clicks WHERE url_id = $1 ORDER BY timestamp DESC', [id]);
        
        // Build CSV string
        let csv = 'Timestamp,Country,Browser,Device\n';
        clicks.rows.forEach(click => {
            csv += `${new Date(click.timestamp).toISOString()},${click.country || 'Unknown'},${click.browser || 'Unknown'},${click.device || 'Unknown'}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${id}.csv"`);
        res.send(csv);

    } catch (error) {
        console.error('Export analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteUrl = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verify URL belongs to user and get short_code for cache removal
        const result = await db.query('SELECT short_code FROM urls WHERE id = $1 AND user_id = $2', [id, userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'URL not found or unauthorized' });
        }

        const shortCode = result.rows[0].short_code;

        // Delete from database (clicks will be deleted via ON DELETE CASCADE)
        await db.query('DELETE FROM urls WHERE id = $1', [id]);

        // Remove from Redis cache
        await redis.del(`url:${shortCode}`);
        await redis.del(`clicks:${id}`);

        res.json({ message: 'URL deleted successfully' });
    } catch (error) {
        console.error('Delete URL error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Total Links count
        const linksCount = await db.query('SELECT COUNT(*) as count FROM urls WHERE user_id = $1', [userId]);
        const totalLinks = parseInt(linksCount.rows[0].count);

        // 2. Total Clicks across all links for this user
        const clicksCount = await db.query(`
            SELECT COUNT(c.id) as count 
            FROM clicks c 
            JOIN urls u ON c.url_id = u.id 
            WHERE u.user_id = $1
        `, [userId]);
        const totalClicks = parseInt(clicksCount.rows[0].count);

        // 3. Simple click trends (last 7 days)
        const trends = await db.query(`
            SELECT DATE(c.timestamp) as date, COUNT(c.id) as count 
            FROM clicks c 
            JOIN urls u ON c.url_id = u.id 
            WHERE u.user_id = $1 
            AND c.timestamp > CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(c.timestamp)
            ORDER BY DATE(c.timestamp) ASC
        `, [userId]);

        // 4. Top Performing Links (Top 5)
        const topLinks = await db.query(`
            SELECT u.id, u.short_code, u.original_url, COUNT(c.id) as click_count
            FROM urls u
            LEFT JOIN clicks c ON u.id = c.url_id
            WHERE u.user_id = $1
            GROUP BY u.id
            ORDER BY click_count DESC
            LIMIT 5
        `, [userId]);

        res.json({
            totalLinks,
            totalClicks,
            trends: trends.rows,
            topLinks: topLinks.rows
        });

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.verifyPassword = async (req, res) => {
    const { id } = req.params; // shortCode or ID
    const { password } = req.body;

    try {
        const result = await db.query('SELECT * FROM urls WHERE id = $1 OR short_code = $1 OR custom_alias = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'URL not found' });
        }

        const url = result.rows[0];
        if (!url.password_hash) {
            return res.json({ message: 'No password required', originalUrl: url.original_url });
        }

        const isMatch = await bcrypt.compare(password, url.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        res.json({ originalUrl: url.original_url });
    } catch (error) {
        console.error('Verify password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
