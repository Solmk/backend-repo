-- This script creates the database schema for the Parking App in MySQL.
-- Ensure you are connected to your 'my_parking_app' database when running this.

-- ============================================================================
-- 1. Create Tables
--    Order matters for foreign key references, so independent tables first.
-- ============================================================================

-- Table for Users (Drivers, Homeowners, Admins)
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL, -- E.g., +251912345678
    email VARCHAR(255) UNIQUE NULL, -- Email can be null if phone is primary identifier
    password_hash TEXT NOT NULL,
    user_type ENUM('driver', 'homeowner', 'admin') NOT NULL, -- 'driver', 'homeowner', 'admin'
    profile_picture_url TEXT,
    identification_verified BOOLEAN DEFAULT FALSE, -- For homeowners
    payment_payout_details JSON, -- Storing bank details or payment processor info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table for Parking Spots
CREATE TABLE IF NOT EXISTS parking_spots (
    spot_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    homeowner_id BIGINT NOT NULL,
    spot_name VARCHAR(255) NOT NULL,
    description TEXT,
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    sub_city VARCHAR(100),
    woreda VARCHAR(100),
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    -- MySQL geometry column for spatial queries
    geom POINT NOT NULL SRID 4326, -- SRID 4326 is WGS 84 (latitude/longitude)
    price_per_hour DECIMAL(10,2) NOT NULL CHECK (price_per_hour > 0),
    spot_type ENUM('private_driveway', 'garage', 'parking_lot', 'street_parking', 'other') NOT NULL,
    vehicle_size_accommodated ENUM('small', 'medium', 'large', 'oversized') NOT NULL,
    amenities JSON, -- Store as JSON array, e.g., '["EV_charger", "covered", "24_7_access"]'
    is_available BOOLEAN DEFAULT TRUE, -- General availability switch
    status ENUM('active', 'inactive', 'pending_verification', 'rejected') DEFAULT 'pending_verification',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (homeowner_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Table for Parking Spot Images
CREATE TABLE IF NOT EXISTS spot_images (
    image_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    spot_id BIGINT NOT NULL,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (spot_id) REFERENCES parking_spots(spot_id) ON DELETE CASCADE
);

-- Table for Parking Spot Availability Slots
CREATE TABLE IF NOT EXISTS spot_availability (
    availability_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    spot_id BIGINT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE,
    CHECK (end_time > start_time),
    FOREIGN KEY (spot_id) REFERENCES parking_spots(spot_id) ON DELETE CASCADE
    -- MySQL does not have a direct equivalent to PostgreSQL's EXCLUDE constraint for time overlaps.
    -- This logic will need to be handled in your application backend.
);

-- Table for Bookings
CREATE TABLE IF NOT EXISTS bookings (
    booking_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    spot_id BIGINT NOT NULL,
    driver_id BIGINT NOT NULL,
    homeowner_id BIGINT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    booking_status ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled_by_driver', 'cancelled_by_homeowner', 'completed') DEFAULT 'pending' NOT NULL,
    payment_status ENUM('pending', 'paid', 'refunded', 'failed') DEFAULT 'pending' NOT NULL,
    driver_check_in_time DATETIME,
    driver_check_out_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (end_time > start_time),
    FOREIGN KEY (spot_id) REFERENCES parking_spots(spot_id) ON DELETE RESTRICT,
    FOREIGN KEY (driver_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (homeowner_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- Table for Reviews
CREATE TABLE IF NOT EXISTS reviews (
    review_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNIQUE NOT NULL, -- 1:1 with bookings, a booking can only have one review
    reviewer_id BIGINT NOT NULL,
    spot_id BIGINT NOT NULL, -- Redundant but useful for direct querying
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (spot_id) REFERENCES parking_spots(spot_id) ON DELETE RESTRICT
);

-- Table for Notifications
CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    related_entity_type ENUM('booking', 'spot', 'review', 'transaction', 'user', 'system'),
    related_entity_id BIGINT, -- ID of the related entity (e.g., booking_id, spot_id)
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Table for Transactions
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    booking_id BIGINT UNIQUE NULL, -- A transaction can be tied to a booking, but not always (e.g., payouts)
    payer_id BIGINT NOT NULL, -- User who paid
    receiver_id BIGINT NOT NULL, -- User who received (e.g., homeowner for booking, driver for refund, platform for fee)
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'ETB' NOT NULL, -- e.g., 'ETB' for Ethiopian Birr
    transaction_type ENUM('booking_payment', 'payout', 'refund', 'platform_fee') NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending' NOT NULL,
    gateway_reference VARCHAR(255), -- Reference ID from payment gateway
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE SET NULL,
    FOREIGN KEY (payer_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ============================================================================
-- 2. Create Indexes
--    Indexes improve query performance, especially on frequently queried columns.
-- ============================================================================

-- Spatial Index for parking_spots.geom (essential for location-based queries)
-- Using SPATIAL INDEX for POINT data type
CREATE SPATIAL INDEX idx_parking_spots_geom ON parking_spots(geom);

-- Other useful indexes
CREATE INDEX idx_parking_spots_homeowner_id ON parking_spots(homeowner_id);
CREATE INDEX idx_parking_spots_city_sub_city ON parking_spots(city, sub_city);
CREATE INDEX idx_spot_availability_time_range ON spot_availability(start_time, end_time);
CREATE INDEX idx_bookings_start_time_end_time ON bookings(start_time, end_time);
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_spot_images_spot_id ON spot_images(spot_id);
CREATE INDEX idx_bookings_spot_id ON bookings(spot_id);
CREATE INDEX idx_bookings_driver_id ON bookings(driver_id);
CREATE INDEX idx_bookings_homeowner_id ON bookings(homeowner_id);
CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_spot_id ON reviews(spot_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX idx_transactions_payer_id ON transactions(payer_id);
CREATE INDEX idx_transactions_receiver_id ON transactions(receiver_id);