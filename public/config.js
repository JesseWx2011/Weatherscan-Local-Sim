// public/config.js

import { Core, MiniCore } from './packages.js';

// Locale configuration (neighborhood, oceaneast, urban, southwest)
const locale = "neighborhood";

const affiliateName = "Verizon";

const apiKey = '8de2d8b3a93542c9a2d8b3a935a2c909';

const weatherIcons = '2010' // XL or 2010

// Define the enabled packages
const enabledPackages = [Core(locale)];

export { locale, affiliateName, enabledPackages, apiKey, weatherIcons };
