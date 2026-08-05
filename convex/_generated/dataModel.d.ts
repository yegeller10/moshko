/* eslint-disable */
/**
 * Explicit data model stub for CI without `npx convex dev`.
 * Refresh by linking a Convex deployment.
 */

export type Id<TableName extends string> = string & { __tableName: TableName };

export type Doc<TableName extends keyof DataModel> =
  DataModel[TableName]["document"];

type SystemFields = {
  _id: Id<string>;
  _creationTime: number;
};

export type DataModel = {
  users: {
    document: SystemFields & {
      _id: Id<"users">;
      workosUserId: string;
      email: string;
      name?: string;
      role: "admin";
      status: "active" | "disabled";
      invitedBy?: Id<"users">;
    };
    fieldPaths: string;
    indexes: {
      by_workosUserId: ["workosUserId"];
      by_email: ["email"];
    };
    searchIndexes: Record<string, never>;
    vectorIndexes: Record<string, never>;
  };
  invites: {
    document: SystemFields & {
      _id: Id<"invites">;
      email: string;
      invitedBy: Id<"users">;
      status: "pending" | "accepted" | "revoked";
      createdAt: number;
    };
    fieldPaths: string;
    indexes: { by_email: ["email"] };
    searchIndexes: Record<string, never>;
    vectorIndexes: Record<string, never>;
  };
  workers: {
    document: SystemFields & {
      _id: Id<"workers">;
      name: string;
      active: boolean;
    };
    fieldPaths: string;
    indexes: { by_name: ["name"] };
    searchIndexes: Record<string, never>;
    vectorIndexes: Record<string, never>;
  };
  clients: {
    document: SystemFields & {
      _id: Id<"clients">;
      name: string;
      email?: string;
      rateMode: "hourly" | "daily";
      hourlyRate: number;
      dailyRate?: number;
      extraHourRate?: number;
      carHourlyRate?: number;
      active: boolean;
    };
    fieldPaths: string;
    indexes: { by_name: ["name"] };
    searchIndexes: Record<string, never>;
    vectorIndexes: Record<string, never>;
  };
  timeEntries: {
    document: SystemFields & {
      _id: Id<"timeEntries">;
      workerId: Id<"workers">;
      clientId: Id<"clients">;
      location: string;
      date: string;
      startTime: string;
      endTime: string;
      hours: number;
      note?: string;
      createdBy: Id<"users">;
      createdAt: number;
    };
    fieldPaths: string;
    indexes: {
      by_client_date: ["clientId", "date"];
      by_date: ["date"];
      by_worker: ["workerId"];
    };
    searchIndexes: Record<string, never>;
    vectorIndexes: Record<string, never>;
  };
  entryAddons: {
    document: SystemFields & {
      _id: Id<"entryAddons">;
      entryId: Id<"timeEntries">;
      type: "car_drive" | "parking" | "other";
      amount: number;
      note?: string;
    };
    fieldPaths: string;
    indexes: { by_entry: ["entryId"] };
    searchIndexes: Record<string, never>;
    vectorIndexes: Record<string, never>;
  };
  rateRules: {
    document: SystemFields & {
      _id: Id<"rateRules">;
      key: "default";
      overtimeConfigured: boolean;
      bands: Array<{
        label: string;
        multiplier: number;
        thresholdHours: number | null;
      }>;
    };
    fieldPaths: string;
    indexes: { by_key: ["key"] };
    searchIndexes: Record<string, never>;
    vectorIndexes: Record<string, never>;
  };
};
