import type { ComponentType } from "react";
import { AliasingLab } from "./aliasing";
import { BeamModesLab } from "./beam-modes";
import { FreeDecayLab } from "./free-decay";
import { MountingLab } from "./mounting";
import { PogoLab } from "./pogo";
import { PsdAnalyzerLab } from "./psd-analyzer";
import { PsdGrmsLab } from "./psd-grms";
import { SensorChainLab } from "./sensor-chain";
import { SrsLab } from "./srs";
import { TransmissibilityLab } from "./transmissibility";

export interface LabMeta {
  id: string;
  title: string;
  blurb: string;
  topic: string;
  component: ComponentType;
}

/** Labs are shared across courses: any lesson block `{ t: "lab", id }` can embed one. */
export const LABS: LabMeta[] = [
  {
    id: "free-decay",
    title: "Free decay",
    blurb: "Watch ζ and fn shape a decaying oscillation.",
    topic: "Vibration",
    component: FreeDecayLab,
  },
  {
    id: "transmissibility",
    title: "Transmissibility",
    blurb: "Where an isolator amplifies, and where it protects.",
    topic: "Vibration",
    component: TransmissibilityLab,
  },
  {
    id: "beam-modes",
    title: "Beam and tube modes",
    blurb: "Closed-form bending and axial frequencies of a launch-vehicle tube.",
    topic: "Structures",
    component: BeamModesLab,
  },
  {
    id: "pogo",
    title: "Pogo frequency check",
    blurb: "Feed-line inertance, accumulator compliance and structural coincidence.",
    topic: "Dynamic environments",
    component: PogoLab,
  },
  {
    id: "psd-grms",
    title: "PSD → Grms",
    blurb: "Edit breakpoints, get Grms, 3σ and Miles' response.",
    topic: "Dynamic environments",
    component: PsdGrmsLab,
  },
  {
    id: "srs",
    title: "Shock response spectrum",
    blurb: "Compute the SRS of a half-sine shock.",
    topic: "Dynamic environments",
    component: SrsLab,
  },
  {
    id: "aliasing",
    title: "Aliasing",
    blurb: "See an alias form when sampling too slowly.",
    topic: "Measurement",
    component: AliasingLab,
  },
  {
    id: "mounting",
    title: "Mounting resonance",
    blurb: "How mounting method limits usable bandwidth.",
    topic: "Measurement",
    component: MountingLab,
  },
  {
    id: "psd-analyzer",
    title: "PSD analyser",
    blurb: "Load your own CSV and compute time history, Welch PSD and Grms.",
    topic: "Measurement",
    component: PsdAnalyzerLab,
  },
  {
    id: "sensor-chain",
    title: "Sensor-chain sizing",
    blurb: "Range, sample rate, resolution and data volume.",
    topic: "Measurement",
    component: SensorChainLab,
  },
];

export const LAB_REGISTRY: Record<string, LabMeta> = Object.fromEntries(LABS.map((l) => [l.id, l]));
