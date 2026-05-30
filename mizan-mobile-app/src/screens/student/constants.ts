import type { Mode, Task } from "../../lib/types";

export const mascotHappy = require("../../../assets/mascot/mascot_happy.png");
export const mascotFocus = require("../../../assets/mascot/mascot_focus.png");
export const mascot3D = require("../../../assets/mascot/mascot.png");

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const isDone = (task: Task) => task.status === "done";
export const modeOptions: Mode[] = ["REVISION", "EXAMEN", "PROJET", "REPOS", "SPORT", "COURS"];
