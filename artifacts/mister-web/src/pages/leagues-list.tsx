import { useListLeagues, getListLeaguesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Search, Users, Calendar, Shield, Trophy } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeaguesList() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: leagues, isLoading } = useListLeagues(
    {}, 
    { query: { queryKey: getListLeaguesQueryKey({}) } }
  );

  const filteredLeagues = leagues?.filter(l => 
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (l.invitation_code && l.invitation_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary tracking-tight" data-testid="text-leagues-title">
            Lista Leghe
          </h1>
          <p className="text-muted-foreground mt-1">
            Discover and manage fantasy leagues
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leagues/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" data-testid="link-create-league">
            Create League
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Search by league name or invite code..." 
          className="pl-10 h-12 text-lg bg-card border-muted-foreground/20 focus-visible:ring-primary"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          data-testid="input-search-leagues"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filteredLeagues && filteredLeagues.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeagues.map(league => (
            <Link key={league.id} href={`/leagues/${league.id}`}>
              <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group" data-testid={`card-league-${league.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-1">
                      {league.name}
                    </CardTitle>
                    <Badge variant={league.visibility === 'public' ? 'default' : 'secondary'} className="capitalize">
                      {league.visibility}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      <span>Season {league.season}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{league.max_managers} Managers Max</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t mt-4">
                      <Badge variant="outline" className={league.started ? "bg-primary/10 text-primary border-primary/20" : ""}>
                        {league.started ? "Active" : "Registration"}
                      </Badge>
                      {league.admin_user_id === "demo-user" && (
                        <Shield className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border rounded-xl bg-card/50">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No leagues found</h3>
          <p className="text-muted-foreground">Try a different search term or create a new league.</p>
        </div>
      )}
    </div>
  );
}