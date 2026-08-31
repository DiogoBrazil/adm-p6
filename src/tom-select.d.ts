import type TomSelect from "tom-select";

declare global {
  interface HTMLSelectElement {
    tomselect?: TomSelect;
  }
}

export {};
