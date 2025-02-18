import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { useState } from "react";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useHasAccess } from "@/src/features/rbac/utils/checkAccess";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Form,
} from "@/src/components/ui/form";
import { api } from "@/src/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";

import { usePostHog } from "posthog-js/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { Textarea } from "@/src/components/ui/textarea";
import { Checkbox } from "@/src/components/ui/checkbox";
import { extractVariables } from "@/src/utils/string";
import { Badge } from "@/src/components/ui/badge";
import router from "next/router";
import { AutoComplete } from "@/src/features/prompts/components/auto-complete";
import { type AutoCompleteOption } from "@/src/features/prompts/components/auto-complete";

export const CreatePromptDialog = (props: {
  projectId: string;
  title: string;
  promptName?: string;
  promptText?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  const hasAccess = useHasAccess({
    projectId: props.projectId,
    scope: "datasets:CUD",
  });

  return (
    <Dialog open={hasAccess && open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{props.children}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="mb-5">
            {props.title}
            {props.subtitle ? (
              <p className="mt-3 text-sm	font-normal">{props.subtitle}</p>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <NewPromptForm
          projectId={props.projectId}
          promptName={props.promptName}
          promptText={props.promptText}
          onFormSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

const formSchema = z.object({
  name: z.string().min(1, "Enter a name"),
  prompt: z
    .string()
    .min(1, "Enter a prompt")
    .refine((val) => {
      const variables = extractVariables(val);
      const matches = variables.map((variable) => {
        // check regex here
        if (variable.match(/^[A-Za-z]+$/)) {
          return true;
        }
        return false;
      });
      return !matches.includes(false);
    }, "Variables must only contain letters"),
  isActive: z.boolean({
    required_error: "Enter whether the prompt should go live",
  }),
});

export const NewPromptForm = (props: {
  projectId: string;
  onFormSuccess?: () => void;
  promptName?: string;
  promptText?: string;
}) => {
  const [formError, setFormError] = useState<string | null>(null);

  const posthog = usePostHog();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      isActive: false,
      name: props.promptName ?? "",
      prompt: props.promptText ?? "",
    },
  });

  const prompts = api.prompts.all.useQuery({
    projectId: props.projectId,
  });

  const utils = api.useUtils();

  const createPromptMutation = api.prompts.create.useMutation({
    onSuccess: () => utils.prompts.invalidate(),
    onError: (error) => setFormError(error.message),
  });

  const comboboxOptions =
    prompts.data
      ?.map((prompt) => {
        return { label: prompt.name, value: prompt.name };
      })
      .filter(
        (prompt, i, arr) =>
          arr.findIndex((t) => t.label === prompt.label) === i,
      ) ?? [];

  const currentName = form.watch("name");

  const matchingOptions = comboboxOptions.filter((option) =>
    option.label.toLowerCase().includes(currentName.toLowerCase()),
  );

  const extractedVariables = extractVariables(form.watch("prompt"));
  const promptIsActivated = form.watch("isActive");

  function onSubmit(values: z.infer<typeof formSchema>) {
    posthog.capture("prompts:new_prompt_form_submit");

    createPromptMutation
      .mutateAsync({
        ...values,
        projectId: props.projectId,
        name: values.name,
        prompt: values.prompt,
        isActive: values.isActive,
      })
      .then((newPrompt) => {
        props.onFormSuccess?.();
        form.reset();
        // go to the following page after creating the prompt
        if (newPrompt) {
          void router.push(
            `/project/${props.projectId}/prompts/${newPrompt.name}`,
          );
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }

  return (
    <Form {...form}>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => {
            const setNameValue = (value: AutoCompleteOption) => {
              field.onChange(value.value);
            };

            return (
              <div>
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <AutoComplete
                      {...field}
                      options={matchingOptions}
                      placeholder="Select a prompt name"
                      onValueChange={setNameValue}
                      value={{ value: field.value, label: field.value }}
                      disabled={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>
            );
          }}
        />

        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <>
              <FormItem>
                <FormLabel>Prompt</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    className="min-h-[150px] flex-1 font-mono text-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <p className="text-sm text-gray-500">
                You can use <code className="text-xs">{"{{variable}}"}</code> to
                insert variables into your prompt. The following variables are
                available:
              </p>
              <div className="flex flex-wrap gap-2">
                {extractedVariables.map((variable) => (
                  <Badge key={variable} variant="outline">
                    {variable}
                  </Badge>
                ))}
              </div>
            </>
          )}
        />
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Activate prompt</FormLabel>
              </div>
              {promptIsActivated ? (
                <div className="text-xs text-gray-500">
                  Activating the prompt will make it available to the SDKs
                  immediately.
                </div>
              ) : null}
            </FormItem>
          )}
        />
        <Button
          type="submit"
          loading={createPromptMutation.isLoading}
          className="w-full"
        >
          Create prompt
        </Button>
      </form>
      {formError ? (
        <p className="text-red text-center">
          <span className="font-bold">Error:</span> {formError}
        </p>
      ) : null}
    </Form>
  );
};
