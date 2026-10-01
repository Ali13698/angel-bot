const MODULES = [
  './state.js',
  './utils.js',
  './verify.js',
  './rooms.js',
  './matchmaker.js',
  './connection.js',
  './handlers/index.js',
  './handlers/user.js',
  './handlers/lobby.js',
  './handlers/game.js',
  './handlers/social.js',
  './handlers/economy.js',
  './handlers/shop.js'
];

export async function preflight() {
  const errors = [];
  for (const path of MODULES) {
    try {
      await import(path);
    } catch (e) {
      errors.push({ path, message: e.message });
    }
  }
  if (errors.length > 0) {
    console.error('');
    console.error('══════════ PREFLIGHT FAILED ══════════');
    for (const { path, message } of errors) {
      console.error('  ✗ ' + path);
      console.error('    → ' + message);
    }
    console.error('══════════════════════════════════════');
    process.exit(1);
  }
  console.log('✅ preflight ok — ' + MODULES.length + ' modules loaded');
}
