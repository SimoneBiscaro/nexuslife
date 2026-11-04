import { Component, h } from '../../vendor/preact.mjs';

const shallowEqual = (a, b) => {
  for (const k in a) if (!Object.is(a[k], b[k])) return false;
  for (const k in b) if (!(k in a)) return false;
  return true;
};

/**
 * Come React.memo (Preact core non lo include): il componente si ridisegna solo se cambiano le props.
 * Serve alle righe delle liste lunghe, che altrimenti si ridisegnano tutte a ogni modifica.
 */
export function memo(Comp, equal = shallowEqual) {
  class Memo extends Component {
    shouldComponentUpdate(next) { return !equal(this.props, next); }
    render(props) { return h(Comp, props); }
  }
  Memo.displayName = `memo(${Comp.name || 'Component'})`;
  return Memo;
}
