import { useListTemplates, getListTemplatesQueryKey, useCreateLeague, LeagueInputVisibility } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Clock, Zap, ArrowRight, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  name: z.string().min(3, "League name must be at least 3 characters").max(50),
  template_id: z.string().min(1, "Please select a template"),
  max_managers: z.coerce.number().min(2).max(20).default(8),
  visibility: z.nativeEnum(LeagueInputVisibility).default(LeagueInputVisibility.private),
});

export default function CreateLeague() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: templates, isLoading: isLoadingTemplates } = useListTemplates(
    { active_only: true },
    { query: { queryKey: getListTemplatesQueryKey({ active_only: true }) } }
  );

  const createLeagueMutation = useCreateLeague();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      template_id: "",
      max_managers: 8,
      visibility: LeagueInputVisibility.private,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createLeagueMutation.mutate({
      data: {
        name: values.name,
        template_id: values.template_id,
        max_managers: values.max_managers,
        visibility: values.visibility,
        admin_user_id: "demo-user", // Hardcoded for demo
        season: new Date().getFullYear(),
      }
    }, {
      onSuccess: (league) => {
        toast({
          title: "League created successfully",
          description: "Welcome to your new cockpit.",
        });
        setLocation(`/leagues/${league.id}`);
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Failed to create league",
          description: "An error occurred while setting up the league.",
        });
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold font-serif text-primary tracking-tight" data-testid="text-create-league-title">
          Create New League
        </h1>
        <p className="text-muted-foreground mt-1">
          Select a template and configure your fantasy league parameters.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="border-primary/20 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>League Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Serie A Fantastica" {...field} data-testid="input-league-name" className="max-w-md" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-md">
                <FormField
                  control={form.control}
                  name="max_managers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Managers</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-league-max-managers" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibility</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-league-visibility">
                            <SelectValue placeholder="Select visibility" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={LeagueInputVisibility.private}>Private</SelectItem>
                          <SelectItem value={LeagueInputVisibility.public}>Public</SelectItem>
                          <SelectItem value={LeagueInputVisibility.unlisted}>Unlisted</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Select Template
            </h3>
            <FormDescription>
              Templates dictate the rules, market mechanics, and complexity of your league.
            </FormDescription>
            
            <FormField
              control={form.control}
              name="template_id"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="grid-templates">
                      {isLoadingTemplates ? (
                        <>
                          <Skeleton className="h-[250px] rounded-xl" />
                          <Skeleton className="h-[250px] rounded-xl" />
                          <Skeleton className="h-[250px] rounded-xl" />
                        </>
                      ) : templates?.map((template) => (
                        <Card 
                          key={template.id}
                          className={`cursor-pointer transition-all border-2 ${field.value === template.id ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/50'}`}
                          onClick={() => field.onChange(template.id)}
                          data-testid={`card-template-${template.slug}`}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              <Badge variant={field.value === template.id ? "default" : "secondary"}>
                                {template.complexity_label}
                              </Badge>
                            </div>
                            <CardDescription className="line-clamp-2 min-h-[40px]">
                              {template.description || "A standard fantasy league setup."}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pb-4">
                            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>~{template.minutes_per_week} mins/week</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                <span>{Object.keys(template.feature_flags).length} Advanced Rules</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              type="submit" 
              size="lg" 
              className="px-8" 
              disabled={createLeagueMutation.isPending}
              data-testid="button-submit-league"
            >
              {createLeagueMutation.isPending ? "Creating..." : "Initialize League"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}