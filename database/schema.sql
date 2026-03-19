CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    short_code VARCHAR(50) UNIQUE NOT NULL,
    custom_alias VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expiration_date TIMESTAMP WITH TIME ZONE,
    click_limit INTEGER DEFAULT 0,
    password_hash VARCHAR(255)
);

-- Index for fast lookup on short codes
CREATE INDEX idx_urls_short_code ON urls(short_code);
CREATE INDEX idx_urls_custom_alias ON urls(custom_alias);
CREATE INDEX idx_urls_user_id ON urls(user_id);

CREATE TABLE clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url_id UUID REFERENCES urls(id) ON DELETE CASCADE NOT NULL,
    country VARCHAR(100),
    device VARCHAR(50),
    browser VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast tracking retrieval
CREATE INDEX idx_clicks_url_id ON clicks(url_id);
CREATE INDEX idx_clicks_timestamp ON clicks(timestamp);
