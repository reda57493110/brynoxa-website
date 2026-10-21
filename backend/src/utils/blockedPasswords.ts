import { createHash } from 'crypto';

/**
 * Passwords that must never be set: the old default admin password that was public in this repo's
 * history, plus the most guessed passwords. Kept as SHA-256 of the lowercased password so the list
 * itself does not publish them again.
 */
const BLOCKED = new Set([
  '5c06eb3d5a05a19f49476d694ca81a36344660e9d5b98e3d6a6630f31c2422e7',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  '7676aaafb027c825bd9abab78b234070e702752f625b752e55e55b48e607e358',
  'ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270',
  '4194d1706ed1f408d5e02d672777019f4d5385c766a8c6ca8acba3167d36a7b9',
  '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  '0b14d501a594442a01c6859541bcb3e8164d183d32937b851835442f69d5c94e',
  'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
  'f82a7d02e8f0a728b7c3e958c278745cb224d3d7b2e3b84c0ecafc5511fdbdb7',
  '967520ae23e8ee14888bae72809031b98398ae4a636773e18fff917d77679334',
  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
  '8bb0cf6eb9b17d0f7d22b456f121257dc1254e1f01665370476383ea776df414',
  'ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f',
  '15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225',
  'c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646',
  'bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a',
  '91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203',
  '96cae35ce8a9b0244178bf28e4966c2ce1b8385723a96a6b838858cdd6ca0a1e',
  '481f6cc0511143ccdd7e2d1b1b94faf0a700a8b49cd13922a70b5ae28acaa8c5',
  '65e84be33532fb784c48129675f9eff3a682b27168c0ea744b2cf58ee02337c5',
  'daaad6e5604e8e17bd9f108d91e26afe6281dac8fda0091040a7a6d7bd9b43b5',
  'f2d81a260dea8a100dd517984e53c56a7523d96942a834b9cdc249bd4e8c7aa9',
  'f3029a66c61b61b41b428963a2fc134154a5383096c776f3b4064733c5463d90',
  'c9dd06ce6def6eef4d2ad2c909e535f224691473aa5ea40b6f1a1dac5d440e65',
  'be0c7dbc132438130392678b94b8c4fad6422df5c6991bdde8b87fbf79c0b0df',
  'e4ad93ca07acb8d908a3aa41e920ea4f4ef4f26e7f86cf8291c5db289780a5ae',
  'fcc3a23fc7232cc89c7cb0f23d8774fefb73d7dc2ab22e6a1b6b8b202b4dcc91',
  '1c8bfe8f801d79745c4631d09fff36c82aa37fc4cce4fc946683d7b336b63032',
]);

export const BLOCKED_PASSWORD_MESSAGE = 'This password is too common or was published. Please choose another one.';

export function isBlockedPassword(password: string) {
  return BLOCKED.has(createHash('sha256').update(String(password).trim().toLowerCase()).digest('hex'));
}

/** The default admin password that was published in this repo's history: never accepted at sign-in. */
const PUBLISHED_DEFAULT = '5c06eb3d5a05a19f49476d694ca81a36344660e9d5b98e3d6a6630f31c2422e7';

export function isPublishedDefaultPassword(password: string) {
  return createHash('sha256').update(String(password).trim().toLowerCase()).digest('hex') === PUBLISHED_DEFAULT;
}
