import { IncomingMessage } from "http";
import { NextApiRequest, NextPageContext } from "next";
import { NextRequest } from "next/server";

export type AuthResultError = 401 | 403;

export type RequestType = IncomingMessage | NextApiRequest | NextRequest | NextPageContext["req"];
