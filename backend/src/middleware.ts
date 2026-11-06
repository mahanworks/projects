import { Request, Response, NextFunction } from "express";
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any).user;
  if (!user) return res.status(401).json({ error: "Please log in first." });
  (req as any).user = user;
  next();
}
