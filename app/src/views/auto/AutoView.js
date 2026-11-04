import { useEffect, useRef, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader, EmptyState, Skeleton } from '../../ui/Page.js';
import { HudGauge } from '../../ui/HudGauge.js';
import { DigitalTwin } from '../../ui/DigitalTwin.js';
import { Icon } from '../../ui/icons.js';
import { haptic } from '../../ui/haptics.js';
import { useEntities } from '../../store/queries.js';
import { toDateKey } from '../../domain/dates.js';
import { vehicleOverview } from '../../domain/overview.js';
import { vehicleGauges } from './gauges.js';
import { VehicleWizard } from './VehicleWizard.js';
import { DeadlineSheet } from './DeadlineSheet.js';
import { ServiceSheet } from './ServiceSheet.js';
import { KmSheet } from './KmSheet.js';
import { MileageCard } from './MileageCard.js';
import { ExpensesCard } from './ExpensesCard.js';
import { ExpenseSheet } from './ExpenseSheet.js';
import { TyreSheet } from './TyreSheet.js';
import { MaintenanceCard } from '../casa/MaintenanceCard.js';
import { MaintenanceSheet } from '../casa/MaintenanceSheet.js';
import { HomePurchasesCard } from '../casa/HomePurchasesCard.js';
import { HomePurchaseSheet } from '../casa/HomePurchaseSheet.js';

const ENTITIES = ['vehicle', 'vehicleDeadline', 'mileageReading', 'vehicleExpense', 'vehicleMaintenance', 'vehiclePurchase'];

export function AutoView() {
  const today = toDateKey(new Date());
  const { data, loading, error } = useEntities(ENTITIES);
  const [wizard, setWizard] = useState(null); // 'create' | 'edit' | null
  const [sheet, setSheet] = useState(null); // tipo di gauge aperto
  const [kmOpen, setKmOpen] = useState(false);
  const [expense, setExpense] = useState(undefined); // undefined = chiuso, null = nuova
  const [maint, setMaint] = useState(undefined);
  const [purchase, setPurchase] = useState(undefined);
  const autoOpened = useRef(false);

  const vehicle = data?.vehicles.slice().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0];

  // Primo avvio della sezione: il wizard si apre da solo.
  useEffect(() => {
    if (!loading && data && !vehicle && !autoOpened.current) {
      autoOpened.current = true;
      setWizard('create');
    }
  }, [loading, vehicle?.id]);

  useEffect(() => {
    const onNew = () => (vehicle ? setExpense(null) : setWizard('create'));
    window.addEventListener('nexus:new', onNew);
    return () => window.removeEventListener('nexus:new', onNew);
  }, [vehicle?.id]);

  if (error) {
    return html`<${PageHeader} eyebrow="Garage" title="Auto" />
      <${EmptyState} icon="alert" title="Archivio non disponibile"
        text="Questo browser non permette di salvare dati (per esempio in navigazione privata)." />`;
  }
  if (loading || !data) return html`<${PageHeader} eyebrow="Garage" title="Auto" /><${Skeleton} cards=${2} label="Caricamento di Auto" />`;

  if (!vehicle) {
    return html`
      <${PageHeader} eyebrow="Garage" title="Auto" />
      <${EmptyState} art="auto" accent="var(--electric-blue-glow)" title="Nessun veicolo"
        text="Il gemello digitale della tua auto terrà d'occhio bollo, assicurazione, revisione, tagliando e cambio gomme.">
        <button class="btn btn--primary empty-state__cta" type="button" onClick=${() => setWizard('create')}>
          <${Icon} name="plus" /> Aggiungi la tua auto
        </button>
      <//>
      <${VehicleWizard} open=${wizard === 'create'} onClose=${() => setWizard(null)} />`;
  }

  const readings = data.mileageReadings.filter((r) => r.vehicleId === vehicle.id);
  const expenses = data.vehicleExpenses.filter((e) => e.vehicleId === vehicle.id);
  const maintenance = data.vehicleMaintenance.filter((m) => m.vehicleId === vehicle.id);
  const purchases = data.vehiclePurchases.filter((p) => p.vehicleId === vehicle.id);
  const overview = vehicleOverview(vehicle, { deadlines: data.vehicleDeadlines, readings }, today);
  const gauges = vehicleGauges(overview, vehicle, today);
  const subtitle = [vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(' · ');
  const openGauge = (key) => { haptic(); setSheet(key); };

  return html`
    <${PageHeader} eyebrow=${subtitle || 'Garage'} title=${vehicle.name || 'Auto'}
      actions=${html`<button class="icon-btn" type="button" onClick=${() => setWizard('edit')} aria-label="Modifica veicolo">
        <${Icon} name="edit" /></button>`} />

    <section class="garage" aria-label="Stato del veicolo">
      <div class="garage__twin spring-in" style="--i:0">
        <${DigitalTwin} color=${vehicle.color} label=${`${vehicle.make || ''} ${vehicle.model || vehicle.name}, ${vehicle.color || ''}`.trim()} />
      </div>
      ${gauges.map((g, i) => html`
        <button class=${`garage__gauge garage__gauge--${i + 1} spring-in`} style=${`--i:${i + 1}`} type="button" key=${g.key}
          onClick=${() => openGauge(g.key)} aria-label=${`${g.label}: apri il dettaglio`}>
          <${HudGauge} value=${g.value} unit=${g.unit} label=${g.label} ratio=${g.ratio} status=${g.status} sublabel=${g.sublabel} size=${128} />
        </button>`)}
    </section>

    <div class="auto-grid">
      <${MileageCard} overview=${overview} readings=${readings} today=${today} onUpdate=${() => setKmOpen(true)} />
      <${ExpensesCard} expenses=${expenses} today=${today} onEdit=${(e) => setExpense(e)} />
      <${MaintenanceCard} entity="vehicleMaintenance" items=${maintenance} today=${today} onEdit=${setMaint}
        currentKm=${overview.currentKm} kmPerDay=${overview.kmPerDay.kmPerDay} index=${2} />
      <${HomePurchasesCard} entity="vehiclePurchase" items=${purchases} onEdit=${setPurchase} index=${3} />
    </div>

    <${VehicleWizard} open=${wizard === 'edit'} vehicle=${vehicle} onClose=${() => setWizard(null)} />
    ${['bollo', 'assicurazione', 'revisione'].map((type) => html`
      <${DeadlineSheet} key=${type} open=${sheet === type} type=${type} record=${overview.deadlines[type]?.record}
        vehicle=${vehicle} today=${today} onClose=${() => setSheet(null)} />`)}
    <${ServiceSheet} open=${sheet === 'tagliando'} vehicle=${vehicle} overview=${overview} today=${today} onClose=${() => setSheet(null)} />
    <${TyreSheet} open=${sheet === 'gomme'} vehicle=${vehicle} today=${today} currentKm=${overview.currentKm} onClose=${() => setSheet(null)} />
    <${MaintenanceSheet} entity="vehicleMaintenance" open=${maint !== undefined} item=${maint || null} today=${today}
      vehicle=${vehicle} currentKm=${overview.currentKm} onClose=${() => setMaint(undefined)} />
    <${HomePurchaseSheet} entity="vehiclePurchase" open=${purchase !== undefined} item=${purchase || null} vehicle=${vehicle}
      onClose=${() => setPurchase(undefined)} />
    <${KmSheet} open=${kmOpen} vehicle=${vehicle} readings=${readings} currentKm=${overview.currentKm} today=${today} onClose=${() => setKmOpen(false)} />
    <${ExpenseSheet} open=${expense !== undefined} expense=${expense || null} vehicle=${vehicle} today=${today}
      onClose=${() => setExpense(undefined)} />`;
}
