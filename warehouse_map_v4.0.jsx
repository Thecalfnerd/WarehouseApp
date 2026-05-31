import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, AlertTriangle, Trash2, Download, RotateCcw,
  Search, DoorOpen, Hash, ChevronRight, RotateCw,
  Upload, CheckCircle, FileText,
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fifbjlpkfojmjmklokhk.supabase.co';       // user fills in
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpZmJqbHBrZm9qbWpta2xvaGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MzU2MTUsImV4cCI6MjA5NTMxMTYxNX0.HDX3qPpH3CkCr1J9fmqFCOgY2nO1wmB5GYqMceaipZY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
