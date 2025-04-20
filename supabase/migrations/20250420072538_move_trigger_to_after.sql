
-- Fix for trigger timing conflict: move ensure_role_assignment to AFTER trigger

DROP TRIGGER IF EXISTS ensure_role_assignment ON public.profiles;

CREATE TRIGGER ensure_role_assignment
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION handle_role_assignment();
