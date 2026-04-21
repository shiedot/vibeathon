"use client";

import type { ReactNode } from "react";
import React, {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import type {
  GlobalOptions as ConfettiGlobalOptions,
  CreateTypes as ConfettiInstance,
  Options as ConfettiOptions,
} from "canvas-confetti";
import confetti from "canvas-confetti";

type Api = {
  fire: (options?: ConfettiOptions) => void;
};

type Props = React.ComponentPropsWithRef<"canvas"> & {
  options?: ConfettiOptions;
  globalOptions?: ConfettiGlobalOptions;
  manualstart?: boolean;
  children?: ReactNode;
};

export type ConfettiRef = Api | null;

const ConfettiContext = createContext<Api>({} as Api);

const ConfettiComponent = forwardRef<ConfettiRef, Props>((props, ref) => {
  const {
    options,
    globalOptions = { resize: true, useWorker: true },
    manualstart = false,
    children,
    ...rest
  } = props;
  const instanceRef = useRef<ConfettiInstance | null>(null);

  const canvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (node !== null) {
        if (instanceRef.current) return;
        instanceRef.current = confetti.create(node, {
          ...globalOptions,
          resize: true,
        });
      } else {
        if (instanceRef.current) {
          instanceRef.current.reset();
          instanceRef.current = null;
        }
      }
    },
    [globalOptions],
  );

  const fire = useCallback(
    async (opts: ConfettiOptions = {}) => {
      try {
        await instanceRef.current?.({ ...options, ...opts });
      } catch (error) {
        console.error("Confetti error:", error);
      }
    },
    [options],
  );

  const api = useMemo<Api>(() => ({ fire }), [fire]);

  useImperativeHandle(ref, () => api, [api]);

  useEffect(() => {
    if (!manualstart) {
      void (async () => {
        try {
          await fire();
        } catch (error) {
          console.error("Confetti effect error:", error);
        }
      })();
    }
  }, [manualstart, fire]);

  return (
    <ConfettiContext.Provider value={api}>
      <canvas ref={canvasRef} {...rest} />
      {children}
    </ConfettiContext.Provider>
  );
});

ConfettiComponent.displayName = "Confetti";

export const Confetti = ConfettiComponent;

interface ConfettiButtonProps extends React.ComponentProps<"button"> {
  options?: ConfettiOptions &
    ConfettiGlobalOptions & { canvas?: HTMLCanvasElement };
}

const ConfettiButtonComponent = ({
  options,
  children,
  ...props
}: ConfettiButtonProps) => {
  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    try {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      await confetti({
        ...options,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
      });
    } catch (error) {
      console.error("Confetti button error:", error);
    }
  };

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
};

ConfettiButtonComponent.displayName = "ConfettiButton";

export const ConfettiButton = ConfettiButtonComponent;

/* ---------------------------------------------------------------------------
 * Vibeathon celebration presets. Each of these is a one-shot imperative fire
 * that renders full-viewport confetti in a style unique to the prize tier.
 * ------------------------------------------------------------------------ */

type PresetFn = () => void;

/** Basic burst — used for every regular battle win. */
export const fireBattleWin: PresetFn = () => {
  void confetti({
    particleCount: 120,
    spread: 75,
    startVelocity: 55,
    origin: { y: 0.6 },
  });
};

/** Grand Champion — side cannons, 3s. */
export const fireGrandChampion: PresetFn = () => {
  const end = Date.now() + 3 * 1000;
  const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

  const frame = () => {
    if (Date.now() > end) return;
    void confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      startVelocity: 60,
      origin: { x: 0, y: 0.5 },
      colors,
    });
    void confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      startVelocity: 60,
      origin: { x: 1, y: 0.5 },
      colors,
    });
    requestAnimationFrame(frame);
  };
  frame();
};

/** Runner-Up — fireworks over 5s. */
export const fireRunnerUp: PresetFn = () => {
  const duration = 5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults: ConfettiOptions = {
    startVelocity: 30,
    spread: 360,
    ticks: 60,
    zIndex: 0,
  };
  const randomInRange = (min: number, max: number) =>
    Math.random() * (max - min) + min;
  const interval = window.setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      window.clearInterval(interval);
      return;
    }
    const particleCount = 50 * (timeLeft / duration);
    void confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    void confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
};

/** Best Coach — gold stars. */
export const fireBestCoach: PresetFn = () => {
  const defaults: ConfettiOptions = {
    spread: 360,
    ticks: 50,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    colors: ["#FFE400", "#FFBD00", "#E89400", "#FFCA6C", "#FDFFB8"],
  };
  const shoot = () => {
    void confetti({
      ...defaults,
      particleCount: 40,
      scalar: 1.2,
      shapes: ["star"],
    });
    void confetti({
      ...defaults,
      particleCount: 10,
      scalar: 0.75,
      shapes: ["circle"],
    });
  };
  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
};

/** Top Scout — custom polygon shapes. */
export const fireTopScout: PresetFn = () => {
  const scalar = 2;
  const triangle = confetti.shapeFromPath({ path: "M0 10 L5 0 L10 10z" });
  const square = confetti.shapeFromPath({
    path: "M0 0 L10 0 L10 10 L0 10 Z",
  });
  const coin = confetti.shapeFromPath({
    path: "M5 0 A5 5 0 1 0 5 10 A5 5 0 1 0 5 0 Z",
  });
  const tree = confetti.shapeFromPath({ path: "M5 0 L10 10 L0 10 Z" });

  const defaults: ConfettiOptions = {
    spread: 360,
    ticks: 60,
    gravity: 0,
    decay: 0.96,
    startVelocity: 20,
    shapes: [triangle, square, coin, tree],
    scalar,
  };

  const shoot = () => {
    void confetti({ ...defaults, particleCount: 30 });
    void confetti({ ...defaults, particleCount: 5 });
    void confetti({
      ...defaults,
      particleCount: 15,
      scalar: scalar / 2,
      shapes: ["circle"],
    });
  };
  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
};

/** Participation floor — unicorn emoji rain. */
export const fireParticipation: PresetFn = () => {
  const scalar = 2;
  const unicorn = confetti.shapeFromText({ text: "🦄", scalar });

  const defaults: ConfettiOptions = {
    spread: 360,
    ticks: 60,
    gravity: 0,
    decay: 0.96,
    startVelocity: 20,
    shapes: [unicorn],
    scalar,
  };

  const shoot = () => {
    void confetti({ ...defaults, particleCount: 30 });
    void confetti({ ...defaults, particleCount: 5 });
    void confetti({
      ...defaults,
      particleCount: 15,
      scalar: scalar / 2,
      shapes: ["circle"],
    });
  };
  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
};

export { confetti };
