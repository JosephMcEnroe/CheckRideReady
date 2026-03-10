CREATE TABLE IF NOT EXISTS billing_customers (
  user_id VARCHAR(191) NOT NULL,
  stripe_customer_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_billing_customers_stripe_customer_id (stripe_customer_id)
);
