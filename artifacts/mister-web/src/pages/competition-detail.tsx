import { 
  useGetCompetition, getGetCompetitionQueryKey,
  useUpdateCompetition,
  useDeleteCompetition
} from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trophy, Save, Trash2, ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const compSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  start_giornata: z.coerce.number().min(1).max(38),
  end_giornata: z.coerce.number().min(1).max(38),
  active: z.boolean(),
  completed: z.boolean()
});

export default function CompetitionDetail() {
  const { leagueId, id } = useParams<{ leagueId: string, id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: competition, isLoading } = useGetCompetition(
    id,
    { query: { enabled: !!id, queryKey: getGetCompetitionQueryKey(id) } }
  );

  const updateMutation = useUpdateCompetition();
  const deleteMutation = useDeleteCompetition();

  const form = useForm<z.infer<typeof compSchema>>({
    resolver: zodResolver(compSchema),
    defaultValues: {
      name: "",
      description: "",
      start_giornata: 1,
      end_giornata: 38,
      active: true,
      completed: false
    }
  });

  const isInitialized = useRef(false);

  useEffect(() => {
    if (competition && !isInitialized.current) {
      form.reset({
        name: competition.name,
        description: competition.description || "",
        start_giornata: competition.start_giornata,
        end_giornata: competition.end_giornata,
        active: competition.active,
        completed: competition.completed
      });
      isInitialized.current = true;
    }
  }, [competition, form]);

  const onSubmit = (values: z.infer<typeof compSchema>) => {
    updateMutation.mutate({
      id,
      data: values
    }, {
      onSuccess: (updated) => {
        toast({ title: "Competition updated" });
        queryClient.setQueryData(getGetCompetitionQueryKey(id), updated);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Failed to update competition" });
      }
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Competition deleted" });
        setLocation(`/leagues/${leagueId}`);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Failed to delete competition" });
      }
    });
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-[400px]" /></div>;
  }

  if (!competition) {
    return <div className="text-destructive">Competition not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <Button variant="ghost" className="mb-4 -ml-4" onClick={() => setLocation(`/leagues/${leagueId}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to League
      </Button>
      
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="uppercase font-mono tracking-wider">{competition.type.replace('_', ' ')}</Badge>
            <Badge variant={competition.active ? "default" : "secondary"}>
              {competition.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <h1 className="text-3xl font-bold font-serif text-primary tracking-tight">
            {competition.name}
          </h1>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Competition</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this competition? This action cannot be undone and will remove all associated matches and standings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-comp-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} className="min-h-[100px]" data-testid="input-comp-desc" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="start_giornata"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Giornata</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-comp-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_giornata"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Giornata</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} data-testid="input-comp-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Active Status</FormLabel>
                        <CardDescription>Is this competition currently running?</CardDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="completed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Completed</FormLabel>
                        <CardDescription>Has this competition finished?</CardDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-comp">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
              <Save className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}