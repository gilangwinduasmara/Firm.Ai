
require("dotenv").config();

const config = {
  host: process.env.HOST || 'localhost',
  port: process.env.PORT || 3000,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY || '',
  XENDIT_SECRET_KEY: process.env.XENDIT_SECRET_KEY || '',
}

export default config;