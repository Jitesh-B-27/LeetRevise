import { z } from "zod";

export const difficultySchema = z.enum(["Easy", "Medium", "Hard"]);

export type Difficulty = z.infer<typeof difficultySchema>;
