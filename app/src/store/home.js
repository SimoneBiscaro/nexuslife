import { activeContract } from '../domain/home.js';
import { installmentsToCreate } from '../domain/rent.js';

let running = null;

/**
 * Crea le rate mancanti del mese corrente e del successivo per il contratto attivo.
 * Chiamata all'avvio e all'apertura di Casa; le chiamate concorrenti si accodano.
 * @returns {Promise<number>} rate create
 */
export function ensureRentInstallments(repo, today) {
  const run = async () => {
    const contract = activeContract(await repo.list('rentContract'));
    if (!contract) return 0;
    const missing = installmentsToCreate(contract, await repo.list('rentInstallment'), today);
    if (missing.length) await repo.batch(missing.map((create) => ({ entity: 'rentInstallment', create })));
    return missing.length;
  };
  running = (running || Promise.resolve()).then(run, run);
  return running;
}
