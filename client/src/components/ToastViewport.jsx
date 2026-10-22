import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useApp } from '../state/AppState.jsx';

const icons = { success: CheckCircle2, error: XCircle, info: Info };

export default function ToastViewport() {
  const { toasts } = useApp();
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      <AnimatePresence>
        {toasts.map((item) => {
          const Icon = icons[item.type] || Info;
          return (
            <motion.div key={item.id} className={`toast toast-${item.type}`} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 30 }} role="status">
              <Icon size={18} aria-hidden="true" />
              <span>{item.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
