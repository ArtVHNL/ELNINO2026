import { motion, AnimatePresence } from "motion/react";
import { ReactNode } from "react";

interface GlassTooltipProps {
  x: number | string;
  y: number | string;
  visible: boolean;
  children: ReactNode;
}

export function GlassTooltip({ x, y, visible, children }: GlassTooltipProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 5 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            left: x,
            top: y,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 50,
          }}
          className="bg-[#0B0F19]/80 backdrop-blur-xl px-3.5 py-3 rounded-xl border border-white/20 shadow-[0_0_30px_rgba(0,0,0,0.8)] text-slate-100 text-xs min-w-[150px] font-mono before:content-[''] before:absolute before:inset-0 before:w-full before:h-full before:rounded-xl before:shadow-[inset_0_1px_rgba(255,255,255,0.15)]"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
