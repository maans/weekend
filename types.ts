
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  room: string;
  house: string;
  uniLogin: string;
  teacher1: string;
  teacher2: string;
  isPresent: boolean;
  stayType: 'full' | 'saturday' | 'none';
  isKitchenDuty: boolean;
  hasReturned?: boolean;
  isMarked?: boolean;
  // Sovepladser for hver dag
  sleepingLocations: {
    'Fredag': string;
    'Lørdag': string;
    'Søndag': string;
  };
  note?: string;
  needsExtraDuty?: boolean;
}

export interface TaskSlot {
  id: string;
  label: string;
  day: 'Fredag' | 'Lørdag' | 'Søndag';
  category: 'Mokost' | 'Eftermiddag' | 'Aftensmad' | 'Aftenservering';
  type?: 'Før' | 'Efter';
}

export const CLEANING_CONFIG = [
  { name: "Arken", count: 2 },
  { name: "Den lange gang", count: 3 },
  { name: "Gangene i treenigheden (MT og Gimle)", count: 2 },
  { name: "Biografen", count: 1 },
  { name: "Kunst", count: 1 },
  { name: "Klassefløjen + toiletter", count: 4 },
  { name: "Toiletter i hallen - Alle", count: 3 },
  { name: "Toiletter på den lange gang", count: 2 },
  { name: "Gangen ved TG og Kompo", count: 1 },
  { name: "Gymnastiksalen", count: 2 },
  { name: "Hallen", count: 2 }
];

export const COMMON_SLEEPING_AREAS = [
  "Teltet",
  "Shelteret",
  "Gymnastiksalen",
  "Medie",
  "Biografen"
];

export const TASK_CONFIG: TaskSlot[] = [
  { id: 'fri_dinner_before', label: 'Før Aftensmad', day: 'Fredag', type: 'Før', category: 'Aftensmad' },
  { id: 'fri_dinner_after', label: 'Efter Aftensmad', day: 'Fredag', type: 'Efter', category: 'Aftensmad' },
  { id: 'fri_snack', label: 'Aftenservering', day: 'Fredag', category: 'Aftenservering' },
  
  { id: 'sat_mokost_before', label: 'Før Mokost', day: 'Lørdag', type: 'Før', category: 'Mokost' },
  { id: 'sat_mokost_after', label: 'Efter Mokost', day: 'Lørdag', type: 'Efter', category: 'Mokost' },
  { id: 'sat_afternoon', label: 'Eftermiddagsservering', day: 'Lørdag', category: 'Eftermiddag' },
  { id: 'sat_dinner_before', label: 'Før Aftensmad', day: 'Lørdag', type: 'Før', category: 'Aftensmad' },
  { id: 'sat_dinner_after', label: 'Efter Aftensmad', day: 'Lørdag', type: 'Efter', category: 'Aftensmad' },
  { id: 'sat_snack', label: 'Aftenservering', day: 'Lørdag', category: 'Aftenservering' },
  
  { id: 'sun_mokost_before', label: 'Før Mokost', day: 'Søndag', type: 'Før', category: 'Mokost' },
  { id: 'sun_mokost_after', label: 'Efter Mokost', day: 'Søndag', type: 'Efter', category: 'Mokost' },
  { id: 'sun_afternoon', label: 'Eftermiddagsservering', day: 'Søndag', category: 'Eftermiddag' },
  { id: 'sun_dinner_before', label: 'Før Aftensmad', day: 'Søndag', type: 'Før', category: 'Aftensmad' },
  { id: 'sun_dinner_after', label: 'Efter Aftensmad', day: 'Søndag', type: 'Efter', category: 'Aftensmad' },
  { id: 'sun_snack', label: 'Aftenservering', day: 'Søndag', category: 'Aftenservering' },
];
