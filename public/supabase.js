import { createClient } from "https://esm.sh/@supabase/supabase-js";

export const supabase = createClient(
    "https://xtcrnlnvbzgmplhpufyx.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Y3JubG52YnpnbXBsaHB1Znl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTQzMTgsImV4cCI6MjA4ODgzMDMxOH0.0B7Z5ru3NVTc19PGwH9aryCK1I9eUG5qJoGIUQaUjMk" // public anon key
);
