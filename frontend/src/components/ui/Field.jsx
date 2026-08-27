/**
 * Thin Material UI wrappers used for every form control in the app.
 *
 * Keeping them in one place means the whole app picks up label placement,
 * sizing and helper-text styling consistently, and swapping a Material detail
 * later is a one-file change. `id` is passed straight through, so labels stay
 * associated and existing selectors keep working.
 */
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

/** Single-line text input. */
export function Field({ hint, ...props }) {
  return <TextField helperText={hint} {...props} />;
}

/** Multi-line text input. */
export function TextArea({ hint, rows = 4, ...props }) {
  return <TextField multiline minRows={rows} helperText={hint} {...props} />;
}

/**
 * Native <select> under the hood: it keeps keyboard/mobile behaviour and stays
 * scriptable, while Material provides the outline and label.
 */
export function SelectField({ hint, options = [], placeholder, children, ...props }) {
  return (
    <TextField
      select
      SelectProps={{ native: true }}
      /**
       * A native <select> always renders its current option, including the
       * placeholder one when the value is ''. Material only shrinks the label
       * when it considers the field filled, so without this the label sits on
       * top of the visible option text ("Category" over "All categories").
       */
      InputLabelProps={{ shrink: true }}
      InputProps={{ notched: true }}
      helperText={hint}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => {
        const value = typeof option === 'string' ? option : option.value;
        const label = typeof option === 'string' ? option : option.label;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
      {children}
    </TextField>
  );
}

/** Text input with autocomplete suggestions (used for item categories). */
export function DatalistField({ hint, listId, options = [], ...props }) {
  return (
    <>
      <TextField helperText={hint} inputProps={{ list: listId }} {...props} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

export { MenuItem };
export default Field;
