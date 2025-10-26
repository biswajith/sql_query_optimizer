-- Sample database schema for testing the SQL Query Optimizer

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email)
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  shipping_address TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_order_date (order_date),
  INDEX idx_status (status)
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INT DEFAULT 0,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_price (price)
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price_at_purchase DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_order_id (order_id),
  INDEX idx_product_id (product_id)
);

-- Insert sample data
INSERT INTO users (username, email, first_name, last_name) VALUES
('jdoe', 'john.doe@example.com', 'John', 'Doe'),
('asmith', 'alice.smith@example.com', 'Alice', 'Smith'),
('bjones', 'bob.jones@example.com', 'Bob', 'Jones'),
('cmiller', 'carol.miller@example.com', 'Carol', 'Miller'),
('dwilson', 'david.wilson@example.com', 'David', 'Wilson');

INSERT INTO products (name, description, price, stock_quantity, category) VALUES
('Laptop Pro', 'High-performance laptop', 1299.99, 50, 'Electronics'),
('Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 200, 'Electronics'),
('Desk Chair', 'Comfortable office chair', 249.99, 75, 'Furniture'),
('Monitor 27"', '4K Ultra HD monitor', 399.99, 100, 'Electronics'),
('Desk Lamp', 'LED desk lamp', 49.99, 150, 'Furniture'),
('Keyboard Mechanical', 'RGB mechanical keyboard', 129.99, 120, 'Electronics'),
('Notebook Set', 'Pack of 5 notebooks', 14.99, 300, 'Office Supplies'),
('Pen Pack', 'Pack of 10 pens', 5.99, 500, 'Office Supplies');

INSERT INTO orders (user_id, total_amount, status) VALUES
(1, 1329.98, 'delivered'),
(2, 679.98, 'shipped'),
(1, 149.97, 'delivered'),
(3, 1699.97, 'processing'),
(4, 249.99, 'pending'),
(5, 29.99, 'delivered'),
(2, 399.99, 'delivered'),
(3, 179.98, 'shipped');

INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES
(1, 1, 1, 1299.99),
(1, 2, 1, 29.99),
(2, 4, 1, 399.99),
(2, 5, 1, 49.99),
(2, 6, 1, 129.99),
(3, 7, 10, 14.99),
(4, 1, 1, 1299.99),
(4, 4, 1, 399.99),
(5, 3, 1, 249.99),
(6, 2, 1, 29.99),
(7, 4, 1, 399.99),
(8, 6, 1, 129.99),
(8, 5, 1, 49.99);

