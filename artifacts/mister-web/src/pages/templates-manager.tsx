import { 
  useListTemplates, getListTemplatesQueryKey,
  useCreateTemplate, useUpdateTemplate, useDeleteTemplate
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Clock, Plus, Zap, Settings, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";

const templateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  complexity_label: z.string().min(1),
  minutes_per_week: z.coerce.number().min(0),
  active: z.boolean().default(true),
});

export default function TemplatesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: templates, isLoading } = useListTemplates(
    {},
    { query: { queryKey: getListTemplatesQueryKey({}) } }
  );

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const form = useForm<z.infer<typeof templateSchema>>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      complexity_label: "Medium",
      minutes_per_week: 60,
      active: true,
    }
  });

  const onCreate = (values: z.infer<typeof templateSchema>) => {
    createMutation.mutate({
      data: {
        ...values,
        feature_flags: {
          multi_season_contracts: false,
          free_agent_pool: true
        }
      }
    }, {
      onSuccess: () => {
        toast({ title: "Template created" });
        setIsCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Creation failed" })
    });
  };

  const handleToggleActive = (id: string, active: boolean) => {
    updateMutation.mutate({
      id,
      data: { active }
    }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
      }
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure? This may break leagues using this template.")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Template deleted" });
          queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey({}) });
        }
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            Template Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            System administration for league templates
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create System Template</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="complexity_label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complexity Label</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minutes_per_week"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minutes / Week</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Template"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-[300px] rounded-xl" />
            <Skeleton className="h-[300px] rounded-xl" />
          </>
        ) : templates?.map((template) => (
          <Card key={template.id} className={`border-2 ${template.active ? 'border-primary/20' : 'border-muted opacity-60'}`}>
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{template.name}</CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">{template.slug}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={template.active ? "default" : "secondary"}>
                    {template.active ? "Active" : "Draft"}
                  </Badge>
                  <Switch 
                    checked={template.active} 
                    onCheckedChange={(checked) => handleToggleActive(template.id, checked)} 
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-foreground/80">{template.description}</p>
              
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-muted/10 p-3 rounded-md border">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="font-medium">Complexity:</span> {template.complexity_label}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Time:</span> ~{template.minutes_per_week}m/w
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">Features:</span> {Object.keys(template.feature_flags || {}).length}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(template.id)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}