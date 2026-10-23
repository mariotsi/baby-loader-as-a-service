import styles from './Checklist.module.css';
import { Icon } from './Icon';
import { VisuallyHidden } from './VisuallyHidden';

export interface ChecklistItem {
  id: string;
  label: string;
  met: boolean;
}

interface ChecklistProps {
  items: readonly ChecklistItem[];
  /** Ties the list to the control it describes: pass the same id in the control's `aria-describedby`. */
  id?: string;
  /** Flags the items not met yet, as after a submit they block. */
  flagUnmet?: boolean;
}

/**
 * Requirements that tick off one by one, like the rules of a new password.
 * Each item says in words whether it is met, so the state never rests on the
 * icon or its color alone. The list is not a live region: it describes the
 * control it belongs to, and a form's error says what is still missing.
 */
export function Checklist({ items, id, flagUnmet = false }: ChecklistProps) {
  return (
    <ul id={id} className={styles.list}>
      {items.map((item) => {
        let state = styles.todo;
        if (item.met) {
          state = styles.met;
        } else if (flagUnmet) {
          state = styles.missing;
        }
        return (
          <li key={item.id} className={`${styles.item} ${state}`}>
            <Icon name={item.met ? 'circle-check' : 'circle'} className={styles.icon} />
            <span>
              {item.label}
              <VisuallyHidden>{item.met ? ': done.' : ': not yet.'}</VisuallyHidden>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
