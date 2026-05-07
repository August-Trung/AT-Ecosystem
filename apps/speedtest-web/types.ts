
// AppStatus enum identifies the current phase of the location retrieval and AI analysis process.
export enum AppStatus {
  IDLE = 'IDLE',
  REQUESTING_PERMISSION = 'REQUESTING_PERMISSION',
  FETCHING_COORDINATES = 'FETCHING_COORDINATES',
  ANALYZING_LOCATION = 'ANALYZING_LOCATION',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface LocationLog {
  timestamp: string;
  event: string;
  status: 'pending' | 'success' | 'error';
}

export interface Coordinates {
  lat: number;
  lng: number;
  accuracy: number;
}
