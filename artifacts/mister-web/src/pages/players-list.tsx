import { useListPlayers, getListPlayersQueryKey, ListPlayersRole } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserCircle, Activity } from "lucide-react";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";

// Create a generic useDebounce hook if it doesn't exist yet
export function PlayersList() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [role, setRole] = useState<ListPlayersRole | "ALL">("ALL");

  const queryParams = useMemo(() => {
    const params: any = { limit: 50 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (role !== "ALL") params.role = role;
    return params;
  }, [debouncedSearch, role]);

  const { data, isLoading } = useListPlayers(
    queryParams,
    { query: { queryKey: getListPlayersQueryKey(queryParams) } }
  );

  const getRoleColor = (r: string) => {
    switch(r) {
      case 'GK': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
      case 'DEF': return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
      case 'MID': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
      case 'ATT': return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
      default: return '';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold font-serif text-primary tracking-tight" data-testid="text-players-title">
          Database Giocatori
        </h1>
        <p className="text-muted-foreground mt-1">
          Search and filter the complete Serie A roster
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search by name or team..." 
            className="pl-10 h-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-players"
          />
        </div>
        <Select value={role} onValueChange={(v: any) => setRole(v)}>
          <SelectTrigger className="w-full sm:w-[180px] h-11" data-testid="select-role">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="GK">Portieri (GK)</SelectItem>
            <SelectItem value="DEF">Difensori (DEF)</SelectItem>
            <SelectItem value="MID">Centrocampisti (MID)</SelectItem>
            <SelectItem value="ATT">Attaccanti (ATT)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[80px]">Role</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="hidden md:table-cell">Mantra</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-5 w-32" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-8 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No players found matching your criteria.
                </TableCell>
              </TableRow>
            ) : (
              data?.items.map(player => (
                <TableRow key={player.id} className="group hover:bg-muted/30" data-testid={`row-player-${player.id}`}>
                  <TableCell>
                    <Badge variant="outline" className={`font-mono font-bold ${getRoleColor(player.role_classic)}`}>
                      {player.role_classic}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center overflow-hidden border">
                        {player.photo_url ? (
                          <img src={player.photo_url} alt={player.name} className="h-full w-full object-cover" />
                        ) : (
                          <UserCircle className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {player.name}
                        </div>
                        <div className="text-xs text-muted-foreground hidden sm:block">
                          {player.full_name}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sidebar-foreground/80">
                    {player.real_team}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex gap-1">
                      {player.roles_mantra?.map(r => (
                        <Badge key={r} variant="secondary" className="text-[10px] px-1 py-0 h-4">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {player.injured ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Activity className="h-4 w-4 text-destructive inline" />
                          </TooltipTrigger>
                          <TooltipContent>Injured</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">✓</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        {data && (
          <div className="p-4 border-t bg-muted/20 text-xs text-muted-foreground flex justify-between items-center">
            <span>Showing up to 50 players</span>
            <span>Total in database: {data.total}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Add Tooltip dependencies that were missing
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";