export type ApiHealthResponse = {
  status: string;
  application: string;
  environment: string;
  database: string;
  timestamp: string;
};

export type ApiConnectionState =
  | {
      status: "loading";
      data: null;
      message: string;
    }
  | {
      status: "connected";
      data: ApiHealthResponse;
      message: string;
    }
  | {
      status: "error";
      data: null;
      message: string;
    };