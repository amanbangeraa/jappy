class node:
    def __init__(self, data):
        self.left = None
        self.data = data
        self.right = None
        
def inorder(root):
    if root:
        inorder(root.left)
        print(root.data)
        inorder(root.right)        
        
a =  node(1)
b = node(2)
c = node(3)
a.left = b
a.right = c
inorder(a)
print(a.data, a.left.data, a.right.data)
        