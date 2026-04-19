export interface BMSData {
  device_id: string;
  timestamp_ms: number;
  wifi_rssi_sta: number;
  temperature_c: (number | null)[];
  pack1: PackData;
  pack2: PackData;
  received_at?: number;
}

export interface PackData {
  cell1_v: string;
  cell2_v: string;
  cell3_v: string;
  cell4_v: string;
  total_v: string;
  current_a: string;
  power_w: string;
  status: string;
}
