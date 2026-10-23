import { formatMoney } from '../lib/api.js';
import { Check } from 'lucide-react';

export default function ProductOptionPicker({ options, value, onChange }) {
  if (!options?.items?.length) return null;
  return (
    <fieldset className="product-option-picker">
      <legend>Choose {options.label.toLowerCase()}</legend>
      <div className="product-option-choices">
        {options.items.map((item) => {
          const selected = item.name === value;
          return (
            <button
              className={`product-option-choice ${selected ? 'selected' : ''}`}
              key={item.name}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(item.name)}
            >
              <span className="product-option-choice-name">{item.name}</span>
              <span className="product-option-choice-price">{formatMoney(item.price)}</span>
              {selected && <Check className="product-option-choice-check" size={15} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
