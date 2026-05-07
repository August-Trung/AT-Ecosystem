import { Bank } from './types';

// Popular Vietnamese Banks for VietQR
export const VIET_BANKS: Partial<Bank>[] = [
  { code: 'ICB', name: 'VietinBank', shortName: 'VietinBank', bin: '970415' },
  { code: 'VCB', name: 'Vietcombank', shortName: 'Vietcombank', bin: '970436' },
  { code: 'BIDV', name: 'BIDV', shortName: 'BIDV', bin: '970418' },
  { code: 'VBA', name: 'Agribank', shortName: 'Agribank', bin: '970405' },
  { code: 'MB', name: 'MBBank', shortName: 'MBBank', bin: '970422' },
  { code: 'TCB', name: 'Techcombank', shortName: 'Techcombank', bin: '970407' },
  { code: 'ACB', name: 'ACB', shortName: 'ACB', bin: '970416' },
  { code: 'VPB', name: 'VPBank', shortName: 'VPBank', bin: '970432' },
  { code: 'TPB', name: 'TPBank', shortName: 'TPBank', bin: '970423' },
  { code: 'STB', name: 'Sacombank', shortName: 'Sacombank', bin: '970403' },
  { code: 'HDB', name: 'HDBank', shortName: 'HDBank', bin: '970437' },
  { code: 'VIB', name: 'VIB', shortName: 'VIB', bin: '970441' },
  { code: 'OCB', name: 'OCB', shortName: 'OCB', bin: '970448' },
  { code: 'SHB', name: 'SHB', shortName: 'SHB', bin: '970443' },
  { code: 'LMB', name: 'LienVietPostBank', shortName: 'LPBank', bin: '970449' },
  { code: 'MSB', name: 'MSB', shortName: 'MSB', bin: '970426' },
  { code: 'SSB', name: 'SeABank', shortName: 'SeABank', bin: '970440' },
  { code: 'EIB', name: 'Eximbank', shortName: 'Eximbank', bin: '970431' },
];

export const TOTP_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
