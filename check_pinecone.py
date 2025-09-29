from pinecone import Pinecone
import os

api_key = "pcsk_4REBdc_DdDj6erme8pg4mqeCwFfbhP4cVAQRBMTjpiGLPMjXjGGjSxhX7fqwJnmncMurNr"  # ⬅️ paste your new key here
pc = Pinecone(api_key=api_key)

print("🔍 Available indexes under this API key:")
print(pc.list_indexes())

from pinecone import Pinecone
pc = Pinecone(api_key="pcsk_4REBdc_DdDj6erme8pg4mqeCwFfbhP4cVAQRBMTjpiGLPMjXjGGjSxhX7fqwJnmncMurNr")
index = pc.Index("crop-disease1")
print(index.describe_index_stats())

