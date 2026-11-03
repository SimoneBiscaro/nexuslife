import { useEffect, useRef, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader, EmptyState } from '../../ui/Page.js';
import { useEntities } from '../../store/queries.js';
import { getRepo } from '../../store/repo.js';
import { ensureRentInstallments } from '../../store/home.js';
import { updateSettings } from '../../store/settings.js';
import { toDateKey } from '../../domain/dates.js';
import { activeContract } from '../../domain/home.js';
import { RentCard } from './RentCard.js';
import { ContractSheet } from './ContractSheet.js';
import { PaySheet } from './PaySheet.js';
import { BillsCard } from './BillsCard.js';
import { BillSheet } from './BillSheet.js';
import { MaintenanceCard } from './MaintenanceCard.js';
import { MaintenanceSheet } from './MaintenanceSheet.js';
import { HomePurchasesCard } from './HomePurchasesCard.js';
import { HomePurchaseSheet } from './HomePurchaseSheet.js';

const ENTITIES = ['rentContract', 'rentInstallment', 'bill', 'homeMaintenance', 'homePurchase', 'settings'];

export function CasaView() {
  const today = toDateKey(new Date());
  const { data, error } = useEntities(ENTITIES);
  const [contractOpen, setContractOpen] = useState(false);
  const [paying, setPaying] = useState(null);
  const [bill, setBill] = useState(undefined);
  const [maint, setMaint] = useState(undefined);
  const [hp, setHp] = useState(undefined);
  const prompted = useRef(false);

  const contract = data ? activeContract(data.rentContracts) : null;

  // Rate del mese corrente e del successivo sempre pronte.
  useEffect(() => {
    if (contract) getRepo().then((repo) => ensureRentInstallments(repo, today));
  }, [contract?.id, contract?.updatedAt]);

  // Primo accesso: chiede i dati dell'affitto una volta sola.
  useEffect(() => {
    if (!data || contract || prompted.current) return;
    prompted.current = true;
    if (!data.settings[0]?.rentPromptShown) {
      setContractOpen(true);
      updateSettings({ rentPromptShown: true });
    }
  }, [data, contract?.id]);

  useEffect(() => {
    const onNew = () => setBill(null);
    window.addEventListener('nexus:new', onNew);
    return () => window.removeEventListener('nexus:new', onNew);
  }, []);

  const header = html`<${PageHeader} eyebrow="Affitto e utenze" title="Casa" />`;
  if (error) {
    return html`${header}<${EmptyState} icon="alert" title="Archivio non disponibile"
      text="Questo browser non permette di salvare dati (per esempio in navigazione privata)." />`;
  }
  if (!data) return header;

  return html`
    ${header}
    <div class="casa-grid">
      <${RentCard} contract=${contract} installments=${data.rentInstallments} today=${today}
        onSetup=${() => setContractOpen(true)} onPay=${setPaying} />
      <${BillsCard} bills=${data.bills} today=${today} onEdit=${setBill} />
      <${MaintenanceCard} items=${data.homeMaintenance} today=${today} onEdit=${setMaint} />
      <${HomePurchasesCard} items=${data.homePurchases} onEdit=${setHp} />
    </div>
    <${ContractSheet} open=${contractOpen} onClose=${() => setContractOpen(false)} contract=${contract}
      installments=${data.rentInstallments} today=${today} />
    <${PaySheet} installment=${paying} contract=${contract || {}} today=${today} onClose=${() => setPaying(null)} />
    <${BillSheet} open=${bill !== undefined} bill=${bill || null} today=${today} onClose=${() => setBill(undefined)} />
    <${MaintenanceSheet} open=${maint !== undefined} item=${maint || null} today=${today} onClose=${() => setMaint(undefined)} />
    <${HomePurchaseSheet} open=${hp !== undefined} item=${hp || null} onClose=${() => setHp(undefined)} />`;
}
