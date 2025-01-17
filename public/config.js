// public/config.js

import { Core, MiniCore } from './packages.js';

// Locale configuration (neighborhood, oceaneast, urban, southwest)
const locale = "neighborhood";

const affiliateName = "Comcast Digital Cable";

const apiKey = '';

const weatherIcons = '2010' // XL or 2010

// Define the enabled packages
const enabledPackages = [Core(locale)];

export { locale, affiliateName, enabledPackages, apiKey, weatherIcons };