interface Props {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Toggle = ({ label, description, checked, onChange }: Props) => (
  <label className="flex cursor-pointer items-start justify-between gap-4">
    <span>
      <span className="font-medium">{label}</span>
      {description && <span className="muted block text-xs">{description}</span>}
    </span>
    <input
      type="checkbox"
      className="mt-1 h-5 w-5 shrink-0"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);
