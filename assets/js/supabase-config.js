/* ============================================================
   LukySchool – konfigurace Supabase (veřejné údaje)
   Publishable klíč je určený pro frontend (nahrazuje starý „anon“
   klíč) – bezpečnost zajišťují pravidla RLS na serveru, viz
   soubor supabase.sql. Secret klíč sem NIKDY nepatří.
   SUPA_ENABLED = false vypne cloudovou synchronizaci úplně.
   ============================================================ */
'use strict';

const SUPA_URL = 'https://jxbperjpiiuqzvghlfct.supabase.co';
const SUPA_PUBLISHABLE_KEY = 'sb_publishable_N9Ut9HUNHGb48t1ywj-PhQ_DlzeOisG';
const SUPA_ENABLED = true;
