export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" class="switch" aria-checked={props.checked} aria-label={props.label} onClick={() => props.onChange(!props.checked)} />
  );
}
