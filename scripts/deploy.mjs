// One-command deploy to GitHub Pages (free, permanent). Needs git and the GitHub CLI, signed in: `gh auth login`.
import { execSync } from 'node:child_process';
const sh = (c, o = {}) => execSync(c, { stdio: 'inherit', ...o });
const out = c => execSync(c, { encoding: 'utf8' }).trim();
const name = process.argv[2] || 'whats-next';
try { out('gh auth status'); } catch { console.error('Run `gh auth login` first, then `npm run deploy` again.'); process.exit(1); }
const user = out('gh api user -q .login');
if (!out('git rev-parse --is-inside-work-tree 2>/dev/null || echo no').startsWith('true')) { sh('git init -b main'); }
sh('git add -A'); try { sh('git commit -m "What's Next"'); } catch {}
try { sh(`gh repo create ${name} --public --source=. --remote=origin --push`); } catch { sh('git push -u origin main'); }
try { sh(`gh api -X POST repos/${user}/${name}/pages -f build_type=workflow`, { stdio: 'ignore' }); } catch { try { sh(`gh api -X PUT repos/${user}/${name}/pages -f build_type=workflow`, { stdio: 'ignore' }); } catch {} }
sh(`gh workflow run deploy.yml --repo ${user}/${name}`, { stdio: 'ignore' });
console.log(`\nDone. In about a minute your site is live at:\n  https://${user}.github.io/${name}/\n\nGoogle sign-in: add  https://${user}.github.io  as an Authorized JavaScript origin in your OAuth client.`);
