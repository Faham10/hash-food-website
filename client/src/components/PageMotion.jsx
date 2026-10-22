import { motion, useReducedMotion } from 'framer-motion';

export default function PageMotion({ children, className = '' }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.main
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
    >
      {children}
    </motion.main>
  );
}
