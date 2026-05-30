"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

interface LogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  loading?: boolean;
}

export function OmnixLogo({ size = 150, className = "", style = {}, loading = false }: LogoProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`relative flex items-center justify-center cursor-pointer ${className}`}
      style={{ width: size, height: size, ...style }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      animate={{ scale: isHovered ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Unified Energy Well Gradients */}
          <radialGradient id="aura-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#b91c1c" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fca5a5" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="well-depth" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#ef4444" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#b91c1c" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="crystal-facets" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="40%" stopColor="#fca5a5" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
          </linearGradient>

          {/* Dynamic Filters */}
          <filter id="soft-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feGaussianBlur stdDeviation="12" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Outer Aura (Breathes slowly, expands massively on hover) */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="url(#aura-glow)"
          filter="url(#soft-blur)"
          animate={{
            scale: loading ? [1.1, 1.3, 1.1] : (isHovered ? [1.25, 1.35, 1.25] : [0.95, 1.05, 0.95]),
            opacity: loading ? [0.6, 0.9, 0.6] : (isHovered ? 1 : 0.5),
          }}
          transition={{
            scale: { 
              duration: loading ? 1.2 : (isHovered ? 2 : 6), 
              repeat: Infinity, 
              ease: "easeInOut" 
            },
            opacity: { 
              duration: loading ? 1.2 : 0.5,
              repeat: loading ? Infinity : 0,
              ease: "easeInOut" 
            }
          }}
          style={{ originX: "50px", originY: "50px" }}
        />

        {/* 2. Middle Energy Well (Counter-breathes for organic feel) */}
        <motion.circle
          cx="50"
          cy="50"
          r="32"
          fill="url(#well-depth)"
          animate={{
            scale: loading ? [0.9, 1.1, 0.9] : (isHovered ? 1.05 : [1.05, 0.95, 1.05]),
            opacity: loading ? [0.7, 0.9, 0.7] : (isHovered ? 0.9 : 0.7),
          }}
          transition={{
            scale: { 
              duration: loading ? 1.2 : (isHovered ? 0.5 : 5), 
              repeat: loading ? Infinity : (isHovered ? 0 : Infinity), 
              ease: "easeInOut" 
            },
          }}
          style={{ originX: "50px", originY: "50px" }}
        />

        {/* 3. Outer Orbiting Ring (Continuous rotation + hover wobble) */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={{ 
            duration: loading ? 2 : (isHovered ? 15 : 20), 
            repeat: Infinity, 
            ease: "linear" 
          }}
          style={{ originX: "50px", originY: "50px" }}
        >
          <motion.circle
            cx="50"
            cy="50"
            fill="none"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth={loading ? 3 : 1.5}
            strokeDasharray={loading ? "80 120" : "40 80"}
            strokeLinecap="round"
            animate={{
              r: loading ? 40 : (isHovered ? [40, 41.5, 38.5, 40] : 40),
              strokeWidth: loading ? 3 : (isHovered ? 2.5 : 1.5),
            }}
            transition={{
              r: { duration: 0.15, repeat: Infinity, ease: "linear" },
              strokeWidth: { duration: 0.3 }
            }}
          />
        </motion.g>

        {/* 4. Inner Orbiting Ring (Counter-rotation + hover wobble) */}
        <motion.g
          animate={{ rotate: -360 }}
          transition={{ 
            duration: loading ? 1.5 : (isHovered ? 18 : 25), 
            repeat: Infinity, 
            ease: "linear" 
          }}
          style={{ originX: "50px", originY: "50px" }}
        >
          <motion.circle
            cx="50"
            cy="50"
            fill="none"
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth={loading ? 3 : 2}
            strokeDasharray={loading ? "40 60" : "20 40"}
            strokeLinecap="round"
            animate={{
              r: loading ? 25 : (isHovered ? [25, 26, 24, 25] : 25),
            }}
            transition={{
              r: { duration: 0.2, repeat: Infinity, ease: "linear" },
            }}
          />
        </motion.g>

        {/* 5. Stylized Fusion Crystal (Geometric core replacing the star) */}
        <motion.path
          d="M 50 28 L 62 50 L 50 72 L 38 50 Z"
          fill="url(#crystal-facets)"
          animate={
            loading
              ? {
                  scale: [1, 1.2, 1], // Smooth loading pulse
                  opacity: [0.7, 1, 0.7],
                }
              : isHovered
              ? {
                  scale: [1, 1.4, 0.8, 1.1, 1], // Fast, intense pulse cycle
                  opacity: [1, 0.6, 1],
                }
              : {
                  scale: [0.95, 1.05, 0.95],    // Gentle resting pulse
                  opacity: [0.8, 1, 0.8],
                }
          }
          transition={{
            scale: {
              duration: loading ? 1.2 : (isHovered ? 0.8 : 4),
              repeat: Infinity,
              ease: loading ? "easeInOut" : (isHovered ? "circOut" : "easeInOut"),
            },
            opacity: {
              duration: loading ? 1.2 : (isHovered ? 0.4 : 4),
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
          style={{ originX: "50px", originY: "50px" }}
        />
        
        {/* Core Highlight (Tiny blinding center) */}
        <motion.circle
          cx="50"
          cy="50"
          r="4"
          fill="#ffffff"
          filter="url(#soft-blur)"
          animate={{
            scale: isHovered ? [1, 2, 1] : 1,
            opacity: isHovered ? [0.5, 1, 0.5] : 0.8
          }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      </svg>
    </motion.div>
  );
}